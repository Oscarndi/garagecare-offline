<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceItem;
use Illuminate\Http\Request;

class ServiceItemController extends Controller
{
    public function index(Request $request)
    {
        $query = ServiceItem::query()->latest();

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->limit(100)->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'estimated_price' => ['required', 'numeric', 'min:0'],
            'estimated_duration' => ['nullable', 'integer', 'min:0'],
            'advice' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        return response()->json(['message' => 'Service créé.', 'data' => ServiceItem::create($data)], 201);
    }

    public function show(ServiceItem $serviceItem)
    {
        return response()->json(['data' => $serviceItem]);
    }

    public function update(Request $request, ServiceItem $serviceItem)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'estimated_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'estimated_duration' => ['nullable', 'integer', 'min:0'],
            'advice' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        $serviceItem->update($data);

        return response()->json(['message' => 'Service modifié.', 'data' => $serviceItem]);
    }

    public function destroy(ServiceItem $serviceItem)
    {
        $serviceItem->update(['is_active' => false]);

        return response()->json(['message' => 'Service désactivé.', 'data' => $serviceItem]);
    }
}
