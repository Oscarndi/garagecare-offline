<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LoyaltyController extends Controller
{
    public function show(Customer $customer)
    {
        [$account, $billing] = $this->syncAccountFromBilling($customer);

        return response()->json([
            'data' => [
                'account' => $account,
                'billing' => $billing,
                'work_orders' => $this->customerWorkOrders($customer),
                'transactions' => $this->transactions($customer),
                'reward_rules' => $this->rewardRules(),
            ],
        ]);
    }

    public function earn(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'service_amount' => ['nullable', 'numeric', 'min:0'],
            'parts_amount' => ['nullable', 'numeric', 'min:0'],
            'bonus_points' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string'],
        ]);

        [$account] = $this->syncAccountFromBilling($customer);

        $serviceAmount = (float) ($data['service_amount'] ?? 0);
        $partsAmount = (float) ($data['parts_amount'] ?? 0);
        $bonus = (int) ($data['bonus_points'] ?? 0);

        $points = (int) floor($serviceAmount / 1000)
            + (int) floor($partsAmount / 5000)
            + $bonus;

        if ($points <= 0) {
            return response()->json([
                'message' => 'Aucun point à ajouter.',
            ], 422);
        }

        $now = now();

        DB::table('loyalty_transactions')->insert([
            'customer_id' => $customer->id,
            'work_order_id' => null,
            'type' => 'earn',
            'points' => $points,
            'reason' => $data['reason'] ?? 'Ajustement manuel de points',
            'amount_reference' => $serviceAmount + $partsAmount,
            'created_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->update([
                'points_balance' => (int) $account->points_balance + $points,
                'lifetime_points' => (int) $account->lifetime_points + max(0, $points),
                'tier' => $this->tier((int) $account->lifetime_points + max(0, $points)),
                'last_activity_at' => $now,
                'updated_at' => $now,
            ]);

        return $this->freshPayloadResponse($customer, 'Points ajoutés.');
    }

    public function redeem(Request $request, Customer $customer)
    {
        return response()->json([
            'message' => 'Choisis maintenant un devis précis pour appliquer une récompense. Utilise l’action “Appliquer récompense à une facture”.',
        ], 422);
    }

    public function applyRewardToWorkOrder(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'reward_rule_id' => ['required', 'integer'],
            'work_order_id' => ['required', 'integer'],
            'reason' => ['nullable', 'string'],
        ]);

        [$account, $billing] = $this->syncAccountFromBilling($customer);

        $rule = DB::table('reward_rules')
            ->where('id', $data['reward_rule_id'])
            ->where('is_active', true)
            ->first();

        if (! $rule) {
            return response()->json([
                'message' => 'Récompense introuvable ou inactive.',
            ], 404);
        }

        $workOrder = DB::table('work_orders')
            ->where('id', $data['work_order_id'])
            ->where('customer_id', $customer->id)
            ->first();

        if (! $workOrder) {
            return response()->json([
                'message' => 'Devis ou intervention introuvable pour ce client.',
            ], 404);
        }

        if (($workOrder->status ?? null) === 'annule') {
            return response()->json([
                'message' => 'Impossible d’appliquer une récompense sur une intervention annulée.',
            ], 422);
        }

        if ((float) ($workOrder->discount_amount ?? 0) > 0 || ! empty($workOrder->reward_rule_id)) {
            return response()->json([
                'message' => 'Une remise est déjà appliquée à ce devis/intervention.',
            ], 422);
        }

        if ((int) $account->points_balance < (int) $rule->required_points) {
            return response()->json([
                'message' => 'Solde de points insuffisant.',
            ], 422);
        }

        $selectedDebt = $this->workOrderDebt($workOrder);
        $externalDebt = max(0, (float) $account->debt_current - $selectedDebt);

        if ($externalDebt > 0) {
            return response()->json([
                'message' => 'Une dette client sur une autre facture bloque cette récompense. Encaisse d’abord les dettes ouvertes.',
                'billing' => $billing,
                'debt_reminder' => $this->debtReminderText($customer, $billing),
                'external_debt' => round($externalDebt, 2),
            ], 422);
        }

        $discount = $this->calculateRewardDiscount($rule, $workOrder);
        $baseTotal = $this->baseTotalBeforeDiscount($workOrder);
        $newTotal = max(0, $baseTotal - $discount);
        $now = now();
        $reason = $data['reason'] ?? $rule->name;

        DB::table('work_orders')
            ->where('id', $workOrder->id)
            ->update([
                'total_before_discount' => $baseTotal,
                'discount_amount' => $discount,
                'discount_reason' => $reason,
                'reward_rule_id' => $rule->id,
                'discount_applied_at' => $now,
                'total_amount' => $newTotal,
                'estimated_amount' => $newTotal,
                'updated_at' => $now,
            ]);

        DB::table('loyalty_transactions')->insert([
            'customer_id' => $customer->id,
            'work_order_id' => $workOrder->id,
            'type' => 'redeem',
            'points' => -1 * (int) $rule->required_points,
            'reason' => $reason,
            'amount_reference' => $discount,
            'created_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->update([
                'points_balance' => max(0, (int) $account->points_balance - (int) $rule->required_points),
                'points_redeemed' => (int) $account->points_redeemed + (int) $rule->required_points,
                'last_activity_at' => $now,
                'updated_at' => $now,
            ]);

        return $this->freshPayloadResponse($customer, 'Récompense appliquée à la facture sélectionnée.', [
            'applied_work_order_id' => $workOrder->id,
            'discount_amount' => $discount,
            'total_before_discount' => $baseTotal,
            'total_after_discount' => $newTotal,
        ]);
    }

    public function payDebt(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'work_order_id' => ['nullable', 'integer'],
            'amount' => ['required', 'numeric', 'min:1'],
            'reason' => ['nullable', 'string'],
        ]);

        $amountToApply = (float) $data['amount'];
        $remaining = $amountToApply;
        $allocations = [];
        $now = now();

        $query = DB::table('work_orders')
            ->where('customer_id', $customer->id)
            ->where('status', '!=', 'annule');

        if (! empty($data['work_order_id'])) {
            $query->where('id', $data['work_order_id']);
        }

        $orders = $query
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        foreach ($orders as $order) {
            if ($remaining <= 0) {
                break;
            }

            $total = (float) ($order->total_amount ?: $order->estimated_amount ?: 0);
            $paid = (float) ($order->paid_amount ?: 0);
            $debt = max(0, $total - $paid);

            if ($debt <= 0) {
                continue;
            }

            $apply = min($remaining, $debt);
            $newPaid = $paid + $apply;

            DB::table('work_orders')
                ->where('id', $order->id)
                ->update([
                    'paid_amount' => $newPaid,
                    'paid_at' => $newPaid >= $total ? $now : ($order->paid_at ?: null),
                    'updated_at' => $now,
                ]);

            $allocations[] = [
                'work_order_id' => $order->id,
                'amount' => round($apply, 2),
                'remaining_debt_after' => round(max(0, $total - $newPaid), 2),
            ];

            $remaining -= $apply;
        }

        $applied = $amountToApply - $remaining;

        if ($applied <= 0) {
            return response()->json([
                'message' => 'Aucune dette ouverte à encaisser pour ce client.',
            ], 422);
        }

        DB::table('loyalty_transactions')->insert([
            'customer_id' => $customer->id,
            'work_order_id' => $data['work_order_id'] ?? null,
            'type' => 'debt_payment',
            'points' => 0,
            'reason' => $data['reason'] ?? 'Encaissement dette client',
            'amount_reference' => $applied,
            'created_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $this->freshPayloadResponse($customer, 'Paiement de dette enregistré.', [
            'payment_applied' => round($applied, 2),
            'payment_unapplied' => round(max(0, $remaining), 2),
            'allocations' => $allocations,
        ]);
    }

    public function debtReminder(Request $request, Customer $customer)
    {
        [$account, $billing] = $this->syncAccountFromBilling($customer);

        if ((float) $billing['debt_current'] <= 0) {
            return response()->json([
                'message' => 'Aucune dette ouverte pour ce client.',
                'data' => [
                    'account' => $account,
                    'billing' => $billing,
                    'work_orders' => $this->customerWorkOrders($customer),
                    'transactions' => $this->transactions($customer),
                    'reward_rules' => $this->rewardRules(),
                    'debt_reminder' => '',
                ],
            ]);
        }

        $text = $this->debtReminderText($customer, $billing);
        $now = now();

        DB::table('loyalty_transactions')->insert([
            'customer_id' => $customer->id,
            'work_order_id' => null,
            'type' => 'debt_reminder',
            'points' => 0,
            'reason' => $request->input('reason', 'Rappel de dette généré'),
            'amount_reference' => (float) $billing['debt_current'],
            'created_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'message' => 'Rappel de dette généré.',
            'data' => [
                'account' => $account,
                'billing' => $billing,
                'work_orders' => $this->customerWorkOrders($customer),
                'transactions' => $this->transactions($customer),
                'reward_rules' => $this->rewardRules(),
                'debt_reminder' => $text,
            ],
        ]);
    }

    public function adjust(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'points' => ['required', 'integer'],
            'reason' => ['required', 'string'],
        ]);

        [$account] = $this->syncAccountFromBilling($customer);

        $now = now();

        DB::table('loyalty_transactions')->insert([
            'customer_id' => $customer->id,
            'work_order_id' => null,
            'type' => 'adjust',
            'points' => (int) $data['points'],
            'reason' => $data['reason'],
            'amount_reference' => 0,
            'created_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $newBalance = max(0, (int) $account->points_balance + (int) $data['points']);
        $newLifetime = (int) $account->lifetime_points + max(0, (int) $data['points']);

        DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->update([
                'points_balance' => $newBalance,
                'lifetime_points' => $newLifetime,
                'tier' => $this->tier($newLifetime),
                'last_activity_at' => $now,
                'updated_at' => $now,
            ]);

        return $this->freshPayloadResponse($customer, 'Ajustement enregistré.');
    }

    private function freshPayloadResponse(Customer $customer, string $message, array $extra = [])
    {
        [$account, $billing] = $this->syncAccountFromBilling($customer);

        return response()->json([
            'message' => $message,
            'data' => array_merge([
                'account' => $account,
                'billing' => $billing,
                'work_orders' => $this->customerWorkOrders($customer),
                'transactions' => $this->transactions($customer),
                'reward_rules' => $this->rewardRules(),
            ], $extra),
        ]);
    }

    private function ensureAccount(Customer $customer): object
    {
        $account = DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->first();

        if ($account) {
            return $account;
        }

        $now = now();

        DB::table('customer_loyalty_accounts')->insert([
            'customer_id' => $customer->id,
            'points_balance' => 0,
            'lifetime_points' => 0,
            'points_redeemed' => 0,
            'tier' => 'Bronze',
            'relation_score' => 0,
            'total_paid' => 0,
            'total_discount_received' => 0,
            'debt_current' => 0,
            'last_activity_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->first();
    }

    private function syncAccountFromBilling(Customer $customer): array
    {
        $account = $this->ensureAccount($customer);
        $billing = $this->billingSummary($customer);
        $lifetime = (int) ($account->lifetime_points ?? 0);
        $relationScore = $this->relationScore($billing, $lifetime);

        DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->update([
                'total_paid' => $billing['total_paid'],
                'total_discount_received' => $billing['total_discount_received'],
                'debt_current' => $billing['debt_current'],
                'tier' => $this->tier($lifetime),
                'relation_score' => $relationScore,
                'last_activity_at' => $billing['last_activity_at'] ?? now(),
                'updated_at' => now(),
            ]);

        $account = DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customer->id)
            ->first();

        return [$account, $billing];
    }

    private function billingSummary(Customer $customer): array
    {
        $orders = DB::table('work_orders')
            ->where('customer_id', $customer->id)
            ->get();

        $totalBilled = 0.0;
        $totalPaid = 0.0;
        $debt = 0.0;
        $fullyPaid = 0;
        $partialPaid = 0;
        $unpaid = 0;
        $counted = 0;
        $lastActivity = null;

        foreach ($orders as $order) {
            if (($order->status ?? null) === 'annule') {
                continue;
            }

            $total = (float) ($order->total_amount ?: $order->estimated_amount ?: 0);
            $paidRaw = (float) ($order->paid_amount ?: 0);
            $paid = $total > 0 ? min($paidRaw, $total) : max(0, $paidRaw);

            if ($total <= 0 && $paid <= 0) {
                continue;
            }

            $counted++;
            $totalBilled += $total;
            $totalPaid += $paid;
            $debt += max(0, $total - $paid);

            if ($total > 0 && $paid >= $total) {
                $fullyPaid++;
            } elseif ($paid > 0 && $paid < $total) {
                $partialPaid++;
            } elseif ($total > 0 && $paid <= 0) {
                $unpaid++;
            }

            $activity = $order->paid_at ?: $order->updated_at ?: $order->created_at;

            if ($activity && (! $lastActivity || strtotime($activity) > strtotime($lastActivity))) {
                $lastActivity = $activity;
            }
        }

        $discount = (float) DB::table('loyalty_transactions')
            ->where('customer_id', $customer->id)
            ->where('type', 'redeem')
            ->sum('amount_reference');

        return [
            'total_billed' => round($totalBilled, 2),
            'total_paid' => round($totalPaid, 2),
            'debt_current' => round($debt, 2),
            'total_discount_received' => round($discount, 2),
            'work_orders_count' => $counted,
            'fully_paid_count' => $fullyPaid,
            'partial_paid_count' => $partialPaid,
            'unpaid_count' => $unpaid,
            'last_activity_at' => $lastActivity,
            'can_redeem_rewards' => $debt <= 0,
        ];
    }

    private function customerWorkOrders(Customer $customer)
    {
        return DB::table('work_orders')
            ->where('customer_id', $customer->id)
            ->where('status', '!=', 'annule')
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(function ($order) {
                $total = (float) ($order->total_amount ?: $order->estimated_amount ?: 0);
                $paid = (float) ($order->paid_amount ?: 0);

                $order->debt_amount = round(max(0, $total - $paid), 2);
                $order->display_title = $order->title ?: ('Dossier #' . $order->id);
                $order->discount_amount = (float) ($order->discount_amount ?? 0);
                $order->total_before_discount = $order->total_before_discount ? (float) $order->total_before_discount : null;

                return $order;
            });
    }

    private function calculateRewardDiscount(object $rule, object $workOrder): float
    {
        $labor = (float) ($workOrder->labor_amount ?: 0);
        $parts = (float) ($workOrder->parts_amount ?: 0);
        $total = $this->baseTotalBeforeDiscount($workOrder);

        $appliesTo = (string) ($rule->applies_to ?? 'service');
        $base = match ($appliesTo) {
            'labor', 'service', 'diagnostic', 'free_service' => $labor > 0 ? $labor : $total,
            'parts' => $parts,
            default => $total,
        };

        $value = (float) ($rule->discount_value ?? 0);
        $discount = match ((string) ($rule->discount_type ?? 'fixed')) {
            'percentage' => $base * ($value / 100),
            'fixed' => $value,
            'free_service' => $value,
            default => $value,
        };

        $ruleCap = (float) ($rule->max_discount_amount ?? 0);
        if ($ruleCap > 0) {
            $discount = min($discount, $ruleCap);
        }

        $marginCap = $labor > 0 ? $labor * 0.30 : $total * 0.10;
        if ($marginCap > 0) {
            $discount = min($discount, $marginCap);
        }

        return round(max(0, min($discount, $total)), 2);
    }

    private function baseTotalBeforeDiscount(object $workOrder): float
    {
        $before = (float) ($workOrder->total_before_discount ?? 0);

        if ($before > 0) {
            return $before;
        }

        return (float) ($workOrder->total_amount ?: $workOrder->estimated_amount ?: 0);
    }

    private function workOrderDebt(object $workOrder): float
    {
        $total = (float) ($workOrder->total_amount ?: $workOrder->estimated_amount ?: 0);
        $paid = (float) ($workOrder->paid_amount ?: 0);

        return round(max(0, $total - $paid), 2);
    }

    private function debtReminderText(Customer $customer, array $billing): string
    {
        $name = $customer->name ?: 'client';
        $debt = number_format((float) $billing['debt_current'], 0, ',', ' ');

        return "Bonjour {$name}, votre compte GarageCare présente un reste dû de {$debt} FCFA. Merci de régulariser vos factures ouvertes afin de débloquer vos avantages fidélité. Cordialement, GarageCare.";
    }

    private function relationScore(array $billing, int $lifetimePoints): int
    {
        $score = ((float) $billing['total_paid'] / 10000)
            + ((int) $billing['fully_paid_count'] * 10)
            + min(20, $lifetimePoints / 20)
            - ((float) $billing['debt_current'] / 10000)
            - ((int) $billing['unpaid_count'] * 5);

        return max(0, min(100, (int) round($score)));
    }

    private function rewardRules()
    {
        return DB::table('reward_rules')
            ->where('is_active', true)
            ->orderBy('required_points')
            ->get();
    }

    private function transactions(Customer $customer)
    {
        return DB::table('loyalty_transactions')
            ->where('customer_id', $customer->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();
    }

    private function tier(int $lifetimePoints): string
    {
        if ($lifetimePoints >= 700) {
            return 'Premium';
        }

        if ($lifetimePoints >= 300) {
            return 'Gold';
        }

        if ($lifetimePoints >= 100) {
            return 'Silver';
        }

        return 'Bronze';
    }
}
