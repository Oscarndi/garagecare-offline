<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_items', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->string('category', 100);
            $table->text('description')->nullable();
            $table->decimal('estimated_price', 12, 2)->default(0);
            $table->integer('estimated_duration')->nullable();
            $table->text('advice')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_items');
    }
};
