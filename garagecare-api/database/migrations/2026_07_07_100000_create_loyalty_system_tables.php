<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_loyalty_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->unique()->constrained()->cascadeOnDelete();
            $table->integer('points_balance')->default(0);
            $table->integer('lifetime_points')->default(0);
            $table->integer('points_redeemed')->default(0);
            $table->string('tier')->default('Bronze');
            $table->unsignedTinyInteger('relation_score')->default(0);
            $table->decimal('total_paid', 12, 2)->default(0);
            $table->decimal('total_discount_received', 12, 2)->default(0);
            $table->decimal('debt_current', 12, 2)->default(0);
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamps();
        });

        Schema::create('reward_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('required_points');
            $table->string('discount_type')->default('percentage');
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->string('applies_to')->default('service');
            $table->decimal('max_discount_amount', 12, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->integer('points');
            $table->string('reason');
            $table->decimal('amount_reference', 12, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('reward_rules');
        Schema::dropIfExists('customer_loyalty_accounts');
    }
};
