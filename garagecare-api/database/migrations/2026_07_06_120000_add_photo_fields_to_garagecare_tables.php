<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'photo_data')) {
                $table->text('photo_data')->nullable()->after('notes');
            }
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (! Schema::hasColumn('vehicles', 'photo_data')) {
                $table->text('photo_data')->nullable()->after('notes');
            }
        });

        Schema::table('work_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('work_orders', 'before_photo_data')) {
                $table->text('before_photo_data')->nullable()->after('status');
            }

            if (! Schema::hasColumn('work_orders', 'after_photo_data')) {
                $table->text('after_photo_data')->nullable()->after('before_photo_data');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'photo_data')) {
                $table->dropColumn('photo_data');
            }
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'photo_data')) {
                $table->dropColumn('photo_data');
            }
        });

        Schema::table('work_orders', function (Blueprint $table) {
            if (Schema::hasColumn('work_orders', 'before_photo_data')) {
                $table->dropColumn('before_photo_data');
            }

            if (Schema::hasColumn('work_orders', 'after_photo_data')) {
                $table->dropColumn('after_photo_data');
            }
        });
    }
};
