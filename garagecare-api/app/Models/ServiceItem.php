<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ServiceItem extends Model
{
    use HasFactory;

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
        'is_active' => 'boolean',
    ];
}
