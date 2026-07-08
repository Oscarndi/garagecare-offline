<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = Customer::withCount('vehicles')->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%$search%")->orWhere('phone', 'like', "%$search%");
            });
        }

        return response()->json(['data' => $query->limit(100)->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo_data' => ['nullable', 'string'],
        ]);

        return response()->json(['message' => 'Client créé.', 'data' => Customer::create($data)], 201);
    }

    public function show(Customer $customer)
    {
        return response()->json(['data' => $customer->load(['vehicles', 'workOrders.vehicle'])]);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'phone' => ['sometimes', 'required', 'string', 'max:40'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo_data' => ['nullable', 'string'],
        ]);

        $customer->update($data);

        return response()->json(['message' => 'Client modifié.', 'data' => $customer]);
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return response()->json(['message' => 'Client supprimé.']);
    }
}
