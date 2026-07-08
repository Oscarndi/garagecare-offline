<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RewardRule extends Model
{
    protected $fillable = [
        'name',
        'required_points',
        'discount_type',
        'discount_value',
        'applies_to',
        'max_discount_amount',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
