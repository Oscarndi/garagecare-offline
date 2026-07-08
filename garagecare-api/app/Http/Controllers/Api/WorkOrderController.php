<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class WorkOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = WorkOrder::query()->with($this->availableRelations());

        if ($request->filled('customer_id') && Schema::hasColumn('work_orders', 'customer_id')) {
            $query->where('customer_id', $request->integer('customer_id'));
        }

        if ($request->filled('vehicle_id') && Schema::hasColumn('work_orders', 'vehicle_id')) {
            $query->where('vehicle_id', $request->integer('vehicle_id'));
        }

        if ($request->filled('status') && Schema::hasColumn('work_orders', 'status')) {
            $query->where('status', $request->string('status')->toString());
        }

        $orderColumn = Schema::hasColumn('work_orders', 'updated_at') ? 'updated_at' : 'id';

        $orders = $query->orderByDesc($orderColumn)->get();
        $this->attachLoyaltySummary($orders);

        return response()->json([
            'data' => $orders,
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->payload($request, partial: false);
        $workOrder = WorkOrder::create($payload);
        $this->syncWorkOrderParts($workOrder, $request->input('parts'));

        $fresh = $workOrder->fresh()->load($this->availableRelations());
        $loyalty = $this->awardLoyaltyIfEligible($fresh);
        $this->syncCustomerBillingSummary($fresh->customer_id);
        $fresh = $fresh->fresh()->load($this->availableRelations());
        $this->attachLoyaltySummary($fresh);

        return response()->json([
            'data' => $fresh,
            'loyalty' => $loyalty,
        ], 201);
    }

    public function show(WorkOrder $workOrder)
    {
        $loaded = $workOrder->load($this->availableRelations());
        $this->attachLoyaltySummary($loaded);

        return response()->json([
            'data' => $loaded,
        ]);
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        $payload = $this->payload($request, partial: true, existing: $workOrder);
        $workOrder->update($payload);
        $this->syncWorkOrderParts($workOrder->fresh(), $request->input('parts', null));

        $fresh = $workOrder->fresh();
        $loyalty = $this->awardLoyaltyIfEligible($fresh);
        $this->syncCustomerBillingSummary($fresh->customer_id);
        $fresh = $fresh->fresh()->load($this->availableRelations());
        $this->attachLoyaltySummary($fresh);

        return response()->json([
            'data' => $fresh,
            'loyalty' => $loyalty,
        ]);
    }

    public function destroy(WorkOrder $workOrder)
    {
        $customerId = $workOrder->customer_id;
        $workOrder->delete();

        $this->syncCustomerBillingSummary($customerId);

        return response()->json([
            'message' => 'Intervention supprimée.',
        ]);
    }

    private function payload(Request $request, bool $partial = false, ?WorkOrder $existing = null): array
    {
        $rules = [
            'customer_id' => ['nullable', 'integer'],
            'vehicle_id' => ['nullable', 'integer'],
            'service_id' => ['nullable', 'integer'],
            'title' => ['nullable', 'string', 'max:255'],
            'problem_description' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'services' => ['nullable'],
            'services_snapshot' => ['nullable'],
            'status' => ['nullable', 'string', 'max:50'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'scheduled_at' => ['nullable', 'date'],
            'estimated_amount' => ['nullable', 'numeric'],
            'labor_amount' => ['nullable', 'numeric'],
            'parts_amount' => ['nullable', 'numeric'],
            'total_amount' => ['nullable', 'numeric'],
            'paid_amount' => ['nullable', 'numeric'],
            'paid_at' => ['nullable', 'date'],
            'before_photo_data' => ['nullable', 'string'],
            'after_photo_data' => ['nullable', 'string'],
            'parts' => ['nullable', 'array'],
            'parts.*.stock_item_id' => ['nullable', 'integer'],
            'parts.*.stock_item_name' => ['nullable', 'string', 'max:255'],
            'parts.*.category' => ['nullable', 'string', 'max:255'],
            'parts.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'parts.*.unit_price' => ['nullable', 'numeric', 'min:0'],
        ];

        $data = $request->validate($rules);

        $partsPayload = $data['parts'] ?? null;
        unset($data['parts']);

        if (is_array($partsPayload)) {
            $data['parts_amount'] = $this->partsTotalFromPayload($partsPayload);
        }

        if (! $partial) {
            $this->prepareStorePayload($data);
        } else {
            $this->preparePartialPayload($data);
        }

        $this->prepareAmountsAndPayment($data, $existing);

        return $this->onlyExistingColumns($data);
    }

    private function prepareStorePayload(array &$data): void
    {
        $data['status'] = $data['status'] ?? 'propose';

        $services = $this->normalizeServicesValue($data['services_snapshot'] ?? null);

        if (empty($services)) {
            $services = $this->normalizeServicesValue($data['services'] ?? null);
        }

        $fallback = $this->firstFilled([
            $data['problem_description'] ?? null,
            $data['description'] ?? null,
            $data['title'] ?? null,
            $services[0] ?? null,
            'Intervention garage',
        ]);

        if (empty($data['title'])) {
            $data['title'] = $fallback;
        }

        if (empty($data['problem_description'])) {
            $data['problem_description'] = $fallback;
        }

        if (empty($data['description'])) {
            $data['description'] = $data['problem_description'];
        }

        $this->normalizeServicesFields($data, partial: false);
    }

    private function preparePartialPayload(array &$data): void
    {
        if (array_key_exists('description', $data) && empty($data['description'])) {
            unset($data['description']);
        }

        if (array_key_exists('problem_description', $data) && empty($data['problem_description'])) {
            unset($data['problem_description']);
        }

        if (
            array_key_exists('description', $data)
            && ! array_key_exists('problem_description', $data)
            && ! empty($data['description'])
        ) {
            $data['problem_description'] = $data['description'];
        }

        if (
            array_key_exists('problem_description', $data)
            && ! array_key_exists('description', $data)
            && ! empty($data['problem_description'])
        ) {
            $data['description'] = $data['problem_description'];
        }

        if (array_key_exists('title', $data) && empty($data['title'])) {
            unset($data['title']);
        }

        if (array_key_exists('services', $data) || array_key_exists('services_snapshot', $data)) {
            $this->normalizeServicesFields($data, partial: true);

            if (empty($data['services_snapshot'] ?? null)) {
                unset($data['services_snapshot']);
            }

            if (empty($data['services'] ?? null)) {
                unset($data['services']);
            }
        }
    }

    private function prepareAmountsAndPayment(array &$data, ?WorkOrder $existing = null): void
    {
        $labor = $this->money($data['labor_amount'] ?? null);
        $parts = $this->money($data['parts_amount'] ?? null);
        $estimated = $this->money($data['estimated_amount'] ?? null);
        $total = $this->money($data['total_amount'] ?? null);
        $paid = $this->money($data['paid_amount'] ?? null);

        if ($total === null) {
            if ($labor !== null || $parts !== null) {
                $data['total_amount'] = ($labor ?? 0) + ($parts ?? 0);
            } elseif ($estimated !== null) {
                $data['total_amount'] = $estimated;
            }
        }

        if (($data['estimated_amount'] ?? null) === null && isset($data['total_amount'])) {
            $data['estimated_amount'] = $data['total_amount'];
        }

        $computedTotal = $this->money(
            $data['total_amount']
            ?? $data['estimated_amount']
            ?? $existing?->total_amount
            ?? $existing?->estimated_amount
            ?? null
        );

        if (
            $paid !== null
            && $computedTotal !== null
            && $computedTotal > 0
            && $paid >= $computedTotal
            && empty($data['paid_at'])
        ) {
            $data['paid_at'] = now();
        }
    }



    private function syncWorkOrderParts(WorkOrder $workOrder, $partsPayload): void
    {
        if ($partsPayload === null) {
            return;
        }

        if (! is_array($partsPayload) || ! Schema::hasTable('work_order_parts')) {
            return;
        }

        $rows = $this->normalizedPartRows($workOrder->id, $partsPayload);
        $partsTotal = array_sum(array_map(fn ($row) => (float) $row['total_amount'], $rows));

        DB::transaction(function () use ($workOrder, $rows, $partsTotal) {
            $previousRows = DB::table('work_order_parts')
                ->where('work_order_id', $workOrder->id)
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all();

            $previousQuantities = $this->partsQuantityByStockItem($previousRows);
            $nextQuantities = $this->partsQuantityByStockItem($rows);

            $this->applyStockDeltaForParts($workOrder, $previousQuantities, $nextQuantities);
            DB::table('work_order_parts')
                ->where('work_order_id', $workOrder->id)
                ->delete();

            if (! empty($rows)) {
                DB::table('work_order_parts')->insert($rows);
            }

            $labor = $this->money($workOrder->labor_amount ?? null) ?? 0;
            $total = $labor + $partsTotal;

            $updates = [
                'parts_amount' => $partsTotal,
                'total_amount' => $total,
                'estimated_amount' => $total,
                'updated_at' => now(),
            ];

            DB::table('work_orders')
                ->where('id', $workOrder->id)
                ->update(array_intersect_key(
                    $updates,
                    array_flip(Schema::getColumnListing('work_orders'))
                ));
        });
    }

    private function normalizedPartRows(int $workOrderId, array $partsPayload): array
    {
        $rows = [];
        $now = now();

        foreach ($partsPayload as $item) {
            if (! is_array($item)) {
                continue;
            }

            $stockItemId = $item['stock_item_id'] ?? null;
            $snapshot = $this->stockItemSnapshot($stockItemId);

            $name = trim((string) (
                $item['stock_item_name']
                ?? $snapshot['name']
                ?? ''
            ));

            if ($name === '') {
                continue;
            }

            $quantity = $this->money($item['quantity'] ?? null) ?? 1;
            $unitPrice = $this->money($item['unit_price'] ?? null);

            if ($unitPrice === null) {
                $unitPrice = $this->money($snapshot['unit_price'] ?? null) ?? 0;
            }

            if ($quantity <= 0) {
                continue;
            }

            $total = round($quantity * $unitPrice, 2);

            $rows[] = [
                'work_order_id' => $workOrderId,
                'stock_item_id' => $stockItemId ?: null,
                'stock_item_name' => $name,
                'category' => $item['category'] ?? $snapshot['category'] ?? null,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_amount' => $total,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return $rows;
    }

    private function partsQuantityByStockItem(array $rows): array
    {
        $quantities = [];

        foreach ($rows as $row) {
            $stockItemId = (int) ($row['stock_item_id'] ?? 0);
            $quantity = (float) ($row['quantity'] ?? 0);

            if ($stockItemId <= 0 || $quantity <= 0) {
                continue;
            }

            $quantities[$stockItemId] = ($quantities[$stockItemId] ?? 0) + $quantity;
        }

        return $quantities;
    }

    private function applyStockDeltaForParts(WorkOrder $workOrder, array $previousQuantities, array $nextQuantities): void
    {
        if (! Schema::hasTable('stock_items')) {
            return;
        }

        $stockItemIds = array_values(array_unique(array_merge(
            array_keys($previousQuantities),
            array_keys($nextQuantities),
        )));

        foreach ($stockItemIds as $stockItemId) {
            $stockItemId = (int) $stockItemId;

            if ($stockItemId <= 0) {
                continue;
            }

            $previous = (float) ($previousQuantities[$stockItemId] ?? 0);
            $next = (float) ($nextQuantities[$stockItemId] ?? 0);
            $delta = round($next - $previous, 2);

            if (abs($delta) < 0.00001) {
                continue;
            }

            $item = DB::table('stock_items')
                ->where('id', $stockItemId)
                ->lockForUpdate()
                ->first();

            if (! $item) {
                continue;
            }

            $before = (float) ($item->quantity ?? 0);

            if ($delta > 0 && $before < $delta) {
                throw ValidationException::withMessages([
                    'parts' => [
                        sprintf(
                            'Stock insuffisant pour %s : disponible %s, demandé %s.',
                            $item->name ?? ('article #'.$stockItemId),
                            $before,
                            $delta
                        ),
                    ],
                ]);
            }

            $after = round($before - $delta, 2);

            DB::table('stock_items')
                ->where('id', $stockItemId)
                ->update([
                    'quantity' => $after,
                    'updated_at' => now(),
                ]);

            if (Schema::hasTable('stock_movements')) {
                DB::table('stock_movements')->insert([
                    'stock_item_id' => $stockItemId,
                    'work_order_id' => $workOrder->id,
                    'user_id' => auth()->id() ?: ($workOrder->user_id ?: null),
                    'type' => $delta > 0 ? 'work_order_consumption' : 'work_order_return',
                    'quantity_delta' => -1 * $delta,
                    'quantity_before' => $before,
                    'quantity_after' => $after,
                    'reason' => 'Synchronisation pièces intervention #'.$workOrder->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function partsTotalFromPayload(array $partsPayload): float
    {
        $total = 0;

        foreach ($this->normalizedPartRows(0, $partsPayload) as $row) {
            $total += (float) $row['total_amount'];
        }

        return round($total, 2);
    }

    private function stockItemSnapshot($stockItemId): array
    {
        if (! $stockItemId || ! Schema::hasTable('stock_items')) {
            return [];
        }

        $item = DB::table('stock_items')
            ->where('id', $stockItemId)
            ->first();

        if (! $item) {
            return [];
        }

        return [
            'name' => $item->name ?? null,
            'category' => $item->category ?? null,
            'unit_price' => $item->unit_price ?? null,
        ];
    }


    private function syncCustomerBillingSummary($customerId): void
    {
        if (! $customerId || ! Schema::hasTable('customer_loyalty_accounts') || ! Schema::hasTable('work_orders')) {
            return;
        }

        $account = DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customerId)
            ->first();

        if (! $account) {
            $now = now();

            DB::table('customer_loyalty_accounts')->insert([
                'customer_id' => $customerId,
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

            $account = DB::table('customer_loyalty_accounts')
                ->where('customer_id', $customerId)
                ->first();
        }

        $orders = DB::table('work_orders')
            ->where('customer_id', $customerId)
            ->get();

        $totalPaid = 0.0;
        $debt = 0.0;
        $fullyPaid = 0;
        $unpaid = 0;
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

            $totalPaid += $paid;
            $debt += max(0, $total - $paid);

            if ($total > 0 && $paid >= $total) {
                $fullyPaid++;
            }

            if ($total > 0 && $paid <= 0) {
                $unpaid++;
            }

            $activity = $order->paid_at ?: $order->updated_at ?: $order->created_at;

            if ($activity && (! $lastActivity || strtotime($activity) > strtotime($lastActivity))) {
                $lastActivity = $activity;
            }
        }

        $discount = Schema::hasTable('loyalty_transactions')
            ? (float) DB::table('loyalty_transactions')
                ->where('customer_id', $customerId)
                ->where('type', 'redeem')
                ->sum('amount_reference')
            : 0.0;

        $lifetime = (int) ($account->lifetime_points ?? 0);
        $score = ($totalPaid / 10000) + ($fullyPaid * 10) + min(20, $lifetime / 20) - ($debt / 10000) - ($unpaid * 5);
        $score = max(0, min(100, (int) round($score)));

        DB::table('customer_loyalty_accounts')
            ->where('customer_id', $customerId)
            ->update([
                'total_paid' => round($totalPaid, 2),
                'total_discount_received' => round($discount, 2),
                'debt_current' => round($debt, 2),
                'tier' => $this->tier($lifetime),
                'relation_score' => $score,
                'last_activity_at' => $lastActivity ?: now(),
                'updated_at' => now(),
            ]);
    }

    private function attachLoyaltySummary($records): void
    {
        if (! Schema::hasTable('loyalty_transactions')) {
            return;
        }

        $collection = $records instanceof \Illuminate\Database\Eloquent\Collection
            ? $records
            : collect([$records]);

        $ids = $collection
            ->pluck('id')
            ->filter()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        $summaries = DB::table('loyalty_transactions')
            ->select('work_order_id', DB::raw('SUM(points) as loyalty_points'))
            ->whereIn('work_order_id', $ids)
            ->where('type', 'earn')
            ->groupBy('work_order_id')
            ->get()
            ->keyBy('work_order_id');

        $collection->each(function ($workOrder) use ($summaries) {
            $summary = $summaries->get($workOrder->id);
            $points = (int) ($summary->loyalty_points ?? 0);

            $workOrder->setAttribute('loyalty_awarded', $points > 0);
            $workOrder->setAttribute('loyalty_points', $points);
        });
    }

    private function awardLoyaltyIfEligible(?WorkOrder $workOrder): array
    {
        if (! $workOrder) {
            return ['awarded' => false, 'reason' => 'work_order_missing'];
        }

        if (
            ! Schema::hasTable('customer_loyalty_accounts')
            || ! Schema::hasTable('loyalty_transactions')
        ) {
            return ['awarded' => false, 'reason' => 'loyalty_tables_missing'];
        }

        if (! $workOrder->customer_id) {
            return ['awarded' => false, 'reason' => 'customer_missing'];
        }

        $status = (string) ($workOrder->status ?? '');
        if ($status !== 'termine') {
            return ['awarded' => false, 'reason' => 'status_not_termine'];
        }

        $total = $this->money($workOrder->total_amount ?? $workOrder->estimated_amount ?? null) ?? 0;
        $paid = $this->money($workOrder->paid_amount ?? null) ?? 0;

        if ($total <= 0) {
            return ['awarded' => false, 'reason' => 'total_not_positive'];
        }

        if ($paid < $total) {
            return ['awarded' => false, 'reason' => 'not_fully_paid'];
        }

        $alreadyAwarded = DB::table('loyalty_transactions')
            ->where('work_order_id', $workOrder->id)
            ->where('type', 'earn')
            ->exists();

        if ($alreadyAwarded) {
            return ['awarded' => false, 'reason' => 'already_awarded'];
        }

        $serviceAmount = $this->money($workOrder->labor_amount ?? null);

        if ($serviceAmount === null || $serviceAmount <= 0) {
            $partsFallback = $this->money($workOrder->parts_amount ?? null) ?? 0;
            $serviceAmount = max(0, $total - $partsFallback);
        }

        $partsAmount = $this->money($workOrder->parts_amount ?? null) ?? 0;

        $points = (int) floor($serviceAmount / 1000) + (int) floor($partsAmount / 5000);

        if ($points <= 0) {
            return ['awarded' => false, 'reason' => 'points_zero'];
        }

        $now = now();

        DB::transaction(function () use ($workOrder, $points, $serviceAmount, $partsAmount, $total, $now) {
            $account = DB::table('customer_loyalty_accounts')
                ->where('customer_id', $workOrder->customer_id)
                ->first();

            if (! $account) {
                DB::table('customer_loyalty_accounts')->insert([
                    'customer_id' => $workOrder->customer_id,
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

                $account = DB::table('customer_loyalty_accounts')
                    ->where('customer_id', $workOrder->customer_id)
                    ->first();
            }

            DB::table('loyalty_transactions')->insert([
                'customer_id' => $workOrder->customer_id,
                'work_order_id' => $workOrder->id,
                'type' => 'earn',
                'points' => $points,
                'reason' => 'Points automatiques paiement intervention #' . $workOrder->id,
                'amount_reference' => $total,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $newLifetime = (int) $account->lifetime_points + $points;

            DB::table('customer_loyalty_accounts')
                ->where('customer_id', $workOrder->customer_id)
                ->update([
                    'points_balance' => (int) $account->points_balance + $points,
                    'lifetime_points' => $newLifetime,
                    'tier' => $this->tier($newLifetime),
                    'relation_score' => max(0, (int) $account->relation_score + 2),
                    'total_paid' => ((float) $account->total_paid) + $total,
                    'last_activity_at' => $now,
                    'updated_at' => $now,
                ]);
        });

        return [
            'awarded' => true,
            'points' => $points,
            'service_amount' => $serviceAmount,
            'parts_amount' => $partsAmount,
            'amount_reference' => $total,
        ];
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

    private function normalizeServicesFields(array &$data, bool $partial): void
    {
        $hasServicesColumn = Schema::hasColumn('work_orders', 'services');
        $hasSnapshotColumn = Schema::hasColumn('work_orders', 'services_snapshot');

        $services = $this->normalizeServicesValue($data['services_snapshot'] ?? null);

        if (empty($services)) {
            $services = $this->normalizeServicesValue($data['services'] ?? null);
        }

        if (empty($services) && ! empty($data['title'])) {
            $services = [(string) $data['title']];
        }

        if (empty($services) && ! empty($data['problem_description'])) {
            $services = [mb_substr((string) $data['problem_description'], 0, 80)];
        }

        if (empty($services) && ! $partial) {
            $services = ['Intervention garage'];
        }

        if ($hasSnapshotColumn && (! $partial || ! empty($services))) {
            $data['services_snapshot'] = $services;
        }

        if ($hasServicesColumn && (! $partial || ! empty($services))) {
            $data['services'] = $services;
        }
    }

    private function normalizeServicesValue($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_filter(array_map(function ($item) {
                if (is_string($item)) {
                    return trim($item);
                }

                if (is_array($item)) {
                    return trim((string) ($item['name'] ?? $item['title'] ?? $item['label'] ?? $item['service'] ?? ''));
                }

                if (is_object($item)) {
                    return trim((string) ($item->name ?? $item->title ?? $item->label ?? $item->service ?? ''));
                }

                return trim((string) $item);
            }, $value)));
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $this->normalizeServicesValue($decoded);
            }

            return array_values(array_filter(array_map('trim', explode(',', $value))));
        }

        return [];
    }

    private function firstFilled(array $values): string
    {
        foreach ($values as $value) {
            $value = trim((string) $value);

            if ($value !== '') {
                return mb_substr($value, 0, 255);
            }
        }

        return 'Intervention garage';
    }

    private function money($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? round((float) $value, 2) : null;
    }

    private function onlyExistingColumns(array $data): array
    {
        if (! Schema::hasTable('work_orders')) {
            return [];
        }

        $columns = array_flip(Schema::getColumnListing('work_orders'));

        return array_intersect_key($data, $columns);
    }

    private function availableRelations(): array
    {
        $relations = [];

        if (method_exists(WorkOrder::class, 'customer')) {
            $relations[] = 'customer';
        }

        if (method_exists(WorkOrder::class, 'vehicle')) {
            $relations[] = 'vehicle';
        }

        if (method_exists(WorkOrder::class, 'parts')) {
            $relations[] = 'parts';
        }

        if (method_exists(WorkOrder::class, 'user')) {
            $relations[] = 'user';
        }

        return $relations;
    }
}
