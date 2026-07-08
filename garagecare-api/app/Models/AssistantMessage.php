<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class AssistantMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'question',
        'answer',
        'intent',
        'recommended_service_id',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function recommendedService()
    {
        return $this->belongsTo(ServiceItem::class, 'recommended_service_id');
    }
}
