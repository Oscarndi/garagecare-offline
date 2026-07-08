<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerLoyaltyAccount extends Model
{
    protected $fillable = [
        'customer_id',
        'points_balance',
        'lifetime_points',
        'points_redeemed',
        'tier',
        'relation_score',
        'total_paid',
        'total_discount_received',
        'debt_current',
        'last_activity_at',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
    ];
}
