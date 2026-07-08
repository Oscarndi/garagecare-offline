<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    protected $table = 'services';

    protected $fillable = [
        'name',
        'category',
        'description',
        'estimated_price',
        'estimated_duration',
        'advice',
        'is_active',
    ];

    protected $casts = [
        'estimated_price' => 'decimal:2',
        'estimated_duration' => 'integer',
        'is_active' => 'boolean',
    ];
}
