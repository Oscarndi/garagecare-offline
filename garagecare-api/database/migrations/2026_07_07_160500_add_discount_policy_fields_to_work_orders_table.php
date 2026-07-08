<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('work_orders')) {
            return;
        }

        Schema::table('work_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('work_orders', 'total_before_discount')) {
                $table->decimal('total_before_discount', 12, 2)->nullable();
            }

            if (! Schema::hasColumn('work_orders', 'discount_amount')) {
                $table->decimal('discount_amount', 12, 2)->default(0);
            }

            if (! Schema::hasColumn('work_orders', 'discount_reason')) {
                $table->string('discount_reason')->nullable();
            }

            if (! Schema::hasColumn('work_orders', 'reward_rule_id')) {
                $table->unsignedBigInteger('reward_rule_id')->nullable();
            }

            if (! Schema::hasColumn('work_orders', 'discount_applied_at')) {
                $table->timestamp('discount_applied_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('work_orders')) {
            return;
        }

        Schema::table('work_orders', function (Blueprint $table) {
            foreach ([
                'total_before_discount',
                'discount_amount',
                'discount_reason',
                'reward_rule_id',
                'discount_applied_at',
            ] as $column) {
                if (Schema::hasColumn('work_orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
