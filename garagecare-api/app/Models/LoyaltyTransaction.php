<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyTransaction extends Model
{
    protected $fillable = [
        'customer_id',
        'work_order_id',
        'type',
        'points',
        'reason',
        'amount_reference',
        'created_by',
    ];
}
