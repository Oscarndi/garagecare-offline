<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StockItem extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'category', 'quantity', 'alert_threshold', 'unit_price'];

    protected $casts = [
        'unit_price' => 'decimal:2',
    ];
}
