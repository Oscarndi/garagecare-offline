<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_movements')) {
            return;
        }

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_item_id')->nullable()->constrained('stock_items')->nullOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type')->default('work_order_consumption');
            $table->decimal('quantity_delta', 10, 2)->default(0);
            $table->decimal('quantity_before', 10, 2)->default(0);
            $table->decimal('quantity_after', 10, 2)->default(0);
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->index(['work_order_id', 'stock_item_id']);
            $table->index(['stock_item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
