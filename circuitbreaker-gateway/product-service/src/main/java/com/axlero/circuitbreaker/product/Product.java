package com.axlero.circuitbreaker.product;

// A plain data holder for one product. Kept deliberately simple in
// Week 1 - this is catalog data, not the part of the system the
// Circuit Breaker demo cares about (that's the Recommendation
// service, which we'll make unreliable on purpose in Week 2-4).
public class Product {
    private final String id;
    private final String name;
    private final double price;
    private final String category;

    public Product(String id, String name, double price, String category) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.category = category;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public double getPrice() { return price; }
    public String getCategory() { return category; }
}
