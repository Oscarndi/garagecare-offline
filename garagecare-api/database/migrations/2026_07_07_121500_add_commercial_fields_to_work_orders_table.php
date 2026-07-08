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
            if (! Schema::hasColumn('work_orders', 'service_id')) {
                $table->unsignedBigInteger('service_id')->nullable();
            }

            if (! Schema::hasColumn('work_orders', 'title')) {
                $table->string('title')->nullable();
            }

            if (! Schema::hasColumn('work_orders', 'description')) {
                $table->text('description')->nullable();
            }

            if (! Schema::hasColumn('work_orders', 'labor_amount')) {
                $table->decimal('labor_amount', 12, 2)->default(0);
            }

            if (! Schema::hasColumn('work_orders', 'parts_amount')) {
                $table->decimal('parts_amount', 12, 2)->default(0);
            }

            if (! Schema::hasColumn('work_orders', 'total_amount')) {
                $table->decimal('total_amount', 12, 2)->default(0);
            }

            if (! Schema::hasColumn('work_orders', 'paid_amount')) {
                $table->decimal('paid_amount', 12, 2)->default(0);
            }

            if (! Schema::hasColumn('work_orders', 'paid_at')) {
                $table->timestamp('paid_at')->nullable();
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
                'service_id',
                'title',
                'description',
                'labor_amount',
                'parts_amount',
                'total_amount',
                'paid_amount',
                'paid_at',
            ] as $column) {
                if (Schema::hasColumn('work_orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
