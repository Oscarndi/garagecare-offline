<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VehicleController extends Controller
{
    public function index(Request $request)
    {
        $query = Vehicle::with('customer')->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('registration_number', 'like', "%$search%")
                  ->orWhere('brand', 'like', "%$search%")
                  ->orWhere('model', 'like', "%$search%");
            });
        }

        return response()->json(['data' => $query->limit(100)->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id' => ['required', 'exists:customers,id'],
            'registration_number' => ['required', 'string', 'max:50', 'unique:vehicles,registration_number'],
            'brand' => ['required', 'string', 'max:100'],
            'model' => ['required', 'string', 'max:100'],
            'year' => ['nullable', 'integer', 'min:1950', 'max:2100'],
            'color' => ['nullable', 'string', 'max:60'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'fuel_type' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string'],
            'photo_data' => ['nullable', 'string'],
        ]);

        return response()->json(['message' => 'Véhicule créé.', 'data' => Vehicle::create($data)], 201);
    }

    public function show(Vehicle $vehicle)
    {
        return response()->json(['data' => $vehicle->load(['customer', 'workOrders'])]);
    }

    public function update(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate([
            'customer_id' => ['sometimes', 'required', 'exists:customers,id'],
            'registration_number' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('vehicles')->ignore($vehicle->id)],
            'brand' => ['sometimes', 'required', 'string', 'max:100'],
            'model' => ['sometimes', 'required', 'string', 'max:100'],
            'year' => ['nullable', 'integer', 'min:1950', 'max:2100'],
            'color' => ['nullable', 'string', 'max:60'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'fuel_type' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string'],
            'photo_data' => ['nullable', 'string'],
        ]);

        $vehicle->update($data);

        return response()->json(['message' => 'Véhicule modifié.', 'data' => $vehicle]);
    }

    public function destroy(Vehicle $vehicle)
    {
        $vehicle->delete();

        return response()->json(['message' => 'Véhicule supprimé.']);
    }
}
