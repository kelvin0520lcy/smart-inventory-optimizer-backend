"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var db_1 = require("./db");
var schema_1 = require("@shared/schema");
function clearTables() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Clearing existing data...');
                    return [4 /*yield*/, db_1.db.delete(schema_1.forecasts)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.sales)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.productSuppliers)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.products)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.suppliers)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.integrations)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.users)];
                case 7:
                    _a.sent();
                    console.log('All tables cleared');
                    return [2 /*return*/];
            }
        });
    });
}
function seedData() {
    return __awaiter(this, void 0, void 0, function () {
        var user_1, suppliersData, createdSuppliers, productsData, createdProducts, productSuppliersData, createdProductSuppliers, salesData, now_1, _i, createdProducts_1, product, numSales, i, daysAgo, quantity, saleDate, createdSales, forecastsData, createdForecasts, integrationData, createdIntegration, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    // Clear existing data
                    return [4 /*yield*/, clearTables()];
                case 1:
                    // Clear existing data
                    _a.sent();
                    console.log('Tables cleared successfully');
                    // Create demo user
                    console.log('Creating demo user...');
                    return [4 /*yield*/, db_1.db.insert(schema_1.users).values({
                            username: 'demo',
                            password: 'demo123',
                            email: 'demo@example.com',
                            fullName: 'Demo User',
                            plan: 'pro'
                        }).returning()];
                case 2:
                    user_1 = (_a.sent())[0];
                    console.log('Created demo user:', user_1);
                    // Create suppliers
                    console.log('Creating suppliers...');
                    suppliersData = [
                        {
                            name: 'TechSupply Co',
                            contactInfo: 'contact@techsupply.co',
                            performance: 95,
                            leadTime: 5,
                            userId: user_1.id
                        },
                        {
                            name: 'EcoGoods Ltd',
                            contactInfo: 'orders@ecogoods.com',
                            performance: 88,
                            leadTime: 7,
                            userId: user_1.id
                        },
                        {
                            name: 'Premium Distributors',
                            contactInfo: 'sales@premiumdist.com',
                            performance: 92,
                            leadTime: 3,
                            userId: user_1.id
                        }
                    ];
                    return [4 /*yield*/, db_1.db.insert(schema_1.suppliers).values(suppliersData).returning()];
                case 3:
                    createdSuppliers = _a.sent();
                    console.log('Created suppliers:', createdSuppliers);
                    // Create products
                    console.log('Creating products...');
                    productsData = [
                        {
                            name: 'Wireless Headphones',
                            description: 'High-quality wireless headphones with noise cancellation',
                            sku: 'WH-001',
                            price: '129.99',
                            stockQuantity: 3,
                            lowStockThreshold: 10,
                            reorderPoint: 5,
                            category: 'Electronics',
                            userId: user_1.id,
                            platforms: ['shopify'],
                            platformIds: ['123456789']
                        },
                        {
                            name: 'Premium Water Bottle',
                            description: 'Insulated stainless steel water bottle',
                            sku: 'WB-002',
                            price: '24.99',
                            stockQuantity: 45,
                            lowStockThreshold: 20,
                            reorderPoint: 15,
                            category: 'Accessories',
                            userId: user_1.id
                        },
                        {
                            name: 'Organic Cotton T-Shirt (M)',
                            description: 'Medium-sized organic cotton t-shirt',
                            sku: 'TS-003-M',
                            price: '29.99',
                            stockQuantity: 8,
                            lowStockThreshold: 15,
                            reorderPoint: 10,
                            category: 'Apparel',
                            userId: user_1.id
                        },
                        {
                            name: 'Smart Home Hub',
                            description: 'Central hub for smart home automation',
                            sku: 'SH-004',
                            price: '199.99',
                            stockQuantity: 12,
                            lowStockThreshold: 8,
                            reorderPoint: 5,
                            category: 'Electronics',
                            userId: user_1.id
                        }
                    ];
                    return [4 /*yield*/, db_1.db.insert(schema_1.products).values(productsData).returning()];
                case 4:
                    createdProducts = _a.sent();
                    console.log('Created products:', createdProducts);
                    // Create product-supplier relationships
                    console.log('Creating product-supplier relationships...');
                    productSuppliersData = [
                        {
                            productId: createdProducts[0].id,
                            supplierId: createdSuppliers[0].id,
                            price: '89.99',
                            minOrderQuantity: 10
                        },
                        {
                            productId: createdProducts[1].id,
                            supplierId: createdSuppliers[1].id,
                            price: '12.99',
                            minOrderQuantity: 50
                        },
                        {
                            productId: createdProducts[2].id,
                            supplierId: createdSuppliers[1].id,
                            price: '15.99',
                            minOrderQuantity: 25
                        },
                        {
                            productId: createdProducts[3].id,
                            supplierId: createdSuppliers[0].id,
                            price: '149.99',
                            minOrderQuantity: 5
                        }
                    ];
                    return [4 /*yield*/, db_1.db.insert(schema_1.productSuppliers)
                            .values(productSuppliersData)
                            .returning()];
                case 5:
                    createdProductSuppliers = _a.sent();
                    console.log('Created product-supplier relationships:', createdProductSuppliers);
                    // Create sales records
                    console.log('Creating sales records...');
                    salesData = [];
                    now_1 = new Date();
                    for (_i = 0, createdProducts_1 = createdProducts; _i < createdProducts_1.length; _i++) {
                        product = createdProducts_1[_i];
                        numSales = Math.floor(Math.random() * 3) + 3;
                        for (i = 0; i < numSales; i++) {
                            daysAgo = Math.floor(Math.random() * 30);
                            quantity = Math.floor(Math.random() * 5) + 1;
                            saleDate = new Date(now_1);
                            saleDate.setDate(saleDate.getDate() - daysAgo);
                            salesData.push({
                                productId: product.id,
                                userId: user_1.id,
                                quantity: quantity,
                                revenue: (parseFloat(product.price) * quantity).toString(),
                                saleDate: saleDate.toISOString()
                            });
                        }
                    }
                    return [4 /*yield*/, db_1.db.insert(schema_1.sales).values(salesData).returning()];
                case 6:
                    createdSales = _a.sent();
                    console.log('Created sales records:', createdSales);
                    // Create forecasts
                    console.log('Creating forecasts...');
                    forecastsData = createdProducts.map(function (product) { return ({
                        productId: product.id,
                        userId: user_1.id,
                        forecastDate: new Date(now_1.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        forecastQuantity: Math.floor(Math.random() * 50) + 20,
                        confidence: '0.8'
                    }); });
                    return [4 /*yield*/, db_1.db.insert(schema_1.forecasts).values(forecastsData).returning()];
                case 7:
                    createdForecasts = _a.sent();
                    console.log('Created forecasts:', createdForecasts);
                    // Create Shopify integration
                    console.log('Creating Shopify integration...');
                    integrationData = {
                        userId: user_1.id,
                        platform: 'shopify',
                        storeUrl: 'c502-2001-e68-5438-6795-3957-dd38-31ed-4cc6.ngrok-free.app',
                        accessToken: 'dummy_access_token',
                        isConnected: true,
                        lastSynced: new Date()
                    };
                    return [4 /*yield*/, db_1.db.insert(schema_1.integrations).values(integrationData).returning()];
                case 8:
                    createdIntegration = (_a.sent())[0];
                    console.log('Created Shopify integration:', createdIntegration);
                    console.log('Database seeded successfully!');
                    return [3 /*break*/, 10];
                case 9:
                    error_1 = _a.sent();
                    console.error('Error seeding database:', error_1);
                    throw error_1;
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Run the seed function
seedData()
    .then(function () {
    console.log('Seeding completed successfully');
    process.exit(0);
})
    .catch(function (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
});
