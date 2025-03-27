import {
  users, User, InsertUser,
  products, Product, InsertProduct,
  sales, Sale, InsertSale,
  suppliers, Supplier, InsertSupplier,
  productSuppliers, ProductSupplier, InsertProductSupplier,
  forecasts, Forecast, InsertForecast,
  integrations, Integration, InsertIntegration
} from "@shared/schema";
import path from 'path';
import fs from 'fs';

// Define the data directory for persistance
const DATA_DIR = path.join(process.cwd(), 'data');
// Define file paths for each data type
const DATA_FILE = path.join(DATA_DIR, 'storage.json');

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product operations
  getProducts(userId: number): Promise<Product[]>;
  getProductById(id: number): Promise<Product | undefined>;
  getProductByPlatformId(userId: number, platform: string, platformId: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getLowStockProducts(userId: number, threshold?: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  
  // Sales operations
  getSales(userId: number): Promise<Sale[]>;
  getSalesByProduct(productId: number): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;
  
  // Supplier operations
  getSuppliers(userId: number): Promise<Supplier[]>;
  getSupplierById(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<boolean>;
  
  // Product-Supplier operations
  getProductSuppliers(productId: number): Promise<ProductSupplier[]>;
  getProductSuppliersBySupplierId(supplierId: number): Promise<ProductSupplier[]>;
  createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier>;
  
  // Forecast operations
  getForecasts(userId: number): Promise<Forecast[]>;
  getForecastsByProduct(productId: number): Promise<Forecast[]>;
  createForecast(forecast: InsertForecast): Promise<Forecast>;
  
  // Integration operations
  getIntegrations(userId: number): Promise<Integration[]>;
  getIntegrationByPlatform(userId: number, platform: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: number, integration: Partial<Integration>): Promise<Integration | undefined>;
}

interface StorageData {
  users: Map<number, User>;
  products: Map<number, Product>;
  sales: Map<number, Sale>;
  suppliers: Map<number, Supplier>;
  productSuppliers: Map<number, ProductSupplier>;
  forecasts: Map<number, Forecast>;
  integrations: Map<number, Integration>;
  currentUserId: number;
  currentProductId: number;
  currentSaleId: number;
  currentSupplierId: number;
  currentProductSupplierId: number;
  currentForecastId: number;
  currentIntegrationId: number;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private sales: Map<number, Sale>;
  private suppliers: Map<number, Supplier>;
  private productSuppliers: Map<number, ProductSupplier>;
  private forecasts: Map<number, Forecast>;
  private integrations: Map<number, Integration>;
  
  private currentUserId: number;
  private currentProductId: number;
  private currentSaleId: number;
  private currentSupplierId: number;
  private currentProductSupplierId: number;
  private currentForecastId: number;
  private currentIntegrationId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.sales = new Map();
    this.suppliers = new Map();
    this.productSuppliers = new Map();
    this.forecasts = new Map();
    this.integrations = new Map();
    
    this.currentUserId = 1;
    this.currentProductId = 1;
    this.currentSaleId = 1;
    this.currentSupplierId = 1;
    this.currentProductSupplierId = 1;
    this.currentForecastId = 1;
    this.currentIntegrationId = 1;
    
    // Try to load data from file first
    const loaded = this.loadData();
    
    // Add demo data only if not loaded from file or if the demo user doesn't exist
    if (!loaded || !this.users.has(1)) {
      console.log('Initializing demo data...');
      this.initializeDemoData();
    }
  }

  // Save data to file
  private saveData(): void {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      // Convert Maps to arrays for serialization
      const data = {
        users: Array.from(this.users.entries()),
        products: Array.from(this.products.entries()),
        sales: Array.from(this.sales.entries()),
        suppliers: Array.from(this.suppliers.entries()),
        productSuppliers: Array.from(this.productSuppliers.entries()),
        forecasts: Array.from(this.forecasts.entries()),
        integrations: Array.from(this.integrations.entries()),
        currentUserId: this.currentUserId,
        currentProductId: this.currentProductId,
        currentSaleId: this.currentSaleId,
        currentSupplierId: this.currentSupplierId,
        currentProductSupplierId: this.currentProductSupplierId,
        currentForecastId: this.currentForecastId,
        currentIntegrationId: this.currentIntegrationId
      };
      
      // Save to file
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`Data saved to ${DATA_FILE}`);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }
  
  // Load data from file
  private loadData(): boolean {
    try {
      if (fs.existsSync(DATA_FILE)) {
        console.log(`Loading data from ${DATA_FILE}...`);
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(rawData);
        
        // Convert arrays back to Maps
        this.users = new Map(data.users);
        this.products = new Map(data.products);
        this.sales = new Map(data.sales);
        this.suppliers = new Map(data.suppliers);
        this.productSuppliers = new Map(data.productSuppliers);
        this.forecasts = new Map(data.forecasts);
        this.integrations = new Map(data.integrations);
        
        // Set the current IDs
        this.currentUserId = data.currentUserId;
        this.currentProductId = data.currentProductId;
        this.currentSaleId = data.currentSaleId;
        this.currentSupplierId = data.currentSupplierId;
        this.currentProductSupplierId = data.currentProductSupplierId;
        this.currentForecastId = data.currentForecastId;
        this.currentIntegrationId = data.currentIntegrationId;
        
        console.log(`Data loaded successfully. ${this.users.size} users, ${this.products.size} products`);
        return true;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    return false;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  // Create standard user
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const createdAt = new Date();
    
    // Create the user
    const user: User = { 
      ...insertUser, 
      id,
      fullName: insertUser.fullName,
      email: insertUser.email,
      plan: insertUser.plan || "free",
      createdAt
    };
    
    this.users.set(id, user);
    
    // Demo user already has data, for all other users, create empty state
    if (user.username !== "demo") {
      // Create default empty integrations for a new user
      const shopifyIntegration: Integration = {
        id: this.currentIntegrationId++,
        userId: user.id,
        platform: "shopify",
        isConnected: false,
        apiKey: null,
        apiSecret: null,
        storeUrl: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        lastSynced: null,
        settings: null,
        createdAt: new Date()
      };
      
      this.integrations.set(shopifyIntegration.id, shopifyIntegration);
      
      const woocommerceIntegration: Integration = {
        id: this.currentIntegrationId++,
        userId: user.id,
        platform: "woocommerce",
        isConnected: false,
        apiKey: null,
        apiSecret: null, 
        storeUrl: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        lastSynced: null,
        settings: null,
        createdAt: new Date()
      };
      
      this.integrations.set(woocommerceIntegration.id, woocommerceIntegration);
    }
    
    // Save data after creating a user
    this.saveData();
    
    return user;
  }
  
  // Product operations
  async getProducts(userId: number): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.userId === userId,
    );
  }
  
  async getProductById(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async getProductByPlatformId(userId: number, platform: string, platformId: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(
      (product) => 
        product.userId === userId && 
        product.platforms?.includes(platform) && 
        product.platformIds?.includes(platformId)
    );
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const newProduct: Product = {
      ...product,
      id: this.currentProductId++,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.products.set(newProduct.id, newProduct);
    
    // Save data after creating a product
    this.saveData();
    
    return newProduct;
  }
  
  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    
    if (!existingProduct) {
      return undefined;
    }
    
    const updatedProduct = {
      ...existingProduct,
      ...product,
      updatedAt: new Date()
    };
    
    this.products.set(id, updatedProduct);
    
    // Save data after updating a product
    this.saveData();
    
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const deleted = this.products.delete(id);
    
    if (deleted) {
      // Save data after deleting a product
      this.saveData();
    }
    
    return deleted;
  }
  
  async getLowStockProducts(userId: number, threshold?: number): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => {
      if (product.userId !== userId) return false;
      
      const productThreshold = threshold !== undefined ? threshold : (product.lowStockThreshold || 10);
      return product.stockQuantity <= productThreshold;
    });
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  // Sales operations
  async getSales(userId: number): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter(
      (sale) => sale.userId === userId,
    );
  }
  
  async getSalesByProduct(productId: number): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter(
      (sale) => sale.productId === productId,
    );
  }
  
  async createSale(sale: InsertSale): Promise<Sale> {
    const newSale: Sale = {
      ...sale,
      id: this.currentSaleId++,
      createdAt: new Date()
    };
    
    this.sales.set(newSale.id, newSale);
    
    // Save data after creating a sale
    this.saveData();
    
    return newSale;
  }
  
  // Supplier operations
  async getSuppliers(userId: number): Promise<Supplier[]> {
    return Array.from(this.suppliers.values()).filter(
      (supplier) => supplier.userId === userId,
    );
  }
  
  async getSupplierById(id: number): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }
  
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const newSupplier: Supplier = {
      ...supplier,
      id: this.currentSupplierId++,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.suppliers.set(newSupplier.id, newSupplier);
    
    // Save data after creating a supplier
    this.saveData();
    
    return newSupplier;
  }
  
  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const existingSupplier = this.suppliers.get(id);
    
    if (!existingSupplier) {
      return undefined;
    }
    
    const updatedSupplier = {
      ...existingSupplier,
      ...supplier,
      updatedAt: new Date()
    };
    
    this.suppliers.set(id, updatedSupplier);
    
    // Save data after updating a supplier
    this.saveData();
    
    return updatedSupplier;
  }
  
  async deleteSupplier(id: number): Promise<boolean> {
    const deleted = this.suppliers.delete(id);
    
    if (deleted) {
      // Save data after deleting a supplier
      this.saveData();
    }
    
    return deleted;
  }
  
  // Product-Supplier operations
  async getProductSuppliers(productId: number): Promise<ProductSupplier[]> {
    return Array.from(this.productSuppliers.values()).filter(
      (ps) => ps.productId === productId,
    );
  }
  
  async getProductSuppliersBySupplierId(supplierId: number): Promise<ProductSupplier[]> {
    return Array.from(this.productSuppliers.values()).filter(
      (ps) => ps.supplierId === supplierId,
    );
  }
  
  async createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier> {
    const newProductSupplier: ProductSupplier = {
      ...productSupplier,
      id: this.currentProductSupplierId++,
      createdAt: new Date()
    };
    
    this.productSuppliers.set(newProductSupplier.id, newProductSupplier);
    
    // Save data after creating a product-supplier
    this.saveData();
    
    return newProductSupplier;
  }
  
  // Forecast operations
  async getForecasts(userId: number): Promise<Forecast[]> {
    return Array.from(this.forecasts.values()).filter(
      (forecast) => forecast.userId === userId,
    );
  }
  
  async getForecastsByProduct(productId: number): Promise<Forecast[]> {
    return Array.from(this.forecasts.values()).filter(
      (forecast) => forecast.productId === productId,
    );
  }
  
  async createForecast(forecast: InsertForecast): Promise<Forecast> {
    const newForecast: Forecast = {
      ...forecast,
      id: this.currentForecastId++,
      createdAt: new Date()
    };
    
    this.forecasts.set(newForecast.id, newForecast);
    
    // Save data after creating a forecast
    this.saveData();
    
    return newForecast;
  }
  
  // Integration operations
  async getIntegrations(userId: number): Promise<Integration[]> {
    return Array.from(this.integrations.values()).filter(
      (integration) => integration.userId === userId,
    );
  }
  
  async getIntegrationByPlatform(userId: number, platform: string): Promise<Integration | undefined> {
    return Array.from(this.integrations.values()).find(
      (integration) => integration.userId === userId && integration.platform === platform,
    );
  }
  
  async createIntegration(integration: InsertIntegration): Promise<Integration> {
    const newIntegration: Integration = {
      ...integration,
      id: this.currentIntegrationId++,
      createdAt: new Date()
    };
    
    this.integrations.set(newIntegration.id, newIntegration);
    
    // Save data after creating an integration
    this.saveData();
    
    return newIntegration;
  }
  
  async updateIntegration(id: number, integration: Partial<Integration>): Promise<Integration | undefined> {
    const existingIntegration = this.integrations.get(id);
    
    if (!existingIntegration) {
      return undefined;
    }
    
    const updatedIntegration = {
      ...existingIntegration,
      ...integration,
      updatedAt: new Date()
    };
    
    this.integrations.set(id, updatedIntegration);
    
    // Save data after updating an integration
    this.saveData();
    
    return updatedIntegration;
  }

  // Demo data initialization - this creates demo user with ID 1
  private initializeDemoData() {
    // Create demo user
    const demoUser: User = {
      id: 1,
      username: "demo",
      fullName: "Demo User",
      email: "demo@example.com",
      password: "password",
      plan: "pro",
      createdAt: new Date()
    };
    
    this.users.set(demoUser.id, demoUser);
    
    // Rest of the demo data initialization
    // ...existing demo data code...
    
    // Save the initialized demo data
    this.saveData();
  }
}

export const storage = new MemStorage();
