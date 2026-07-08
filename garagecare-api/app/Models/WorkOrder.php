<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrder extends Model
{
    protected $fillable = [
        'customer_id',
        'vehicle_id',
        'user_id',
        'service_id',
        'title',
        'problem_description',
        'description',
        'services',
        'services_snapshot',
        'status',
        'scheduled_at',
        'estimated_amount',
        'labor_amount',
        'parts_amount',
        'total_amount',
        'paid_amount',
        'paid_at',
        'discount_applied_at',
        'reward_rule_id',
        'discount_reason',
        'discount_amount',
        'total_before_discount',
        'before_photo_data',
        'after_photo_data',
    ];

    protected $casts = [
        'services' => 'array',
        'services_snapshot' => 'array',
        'scheduled_at' => 'datetime',
        'paid_at' => 'datetime',
        'estimated_amount' => 'decimal:2',
        'labor_amount' => 'decimal:2',
        'parts_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function parts()
    {
        return $this->hasMany(WorkOrderPart::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }


}

