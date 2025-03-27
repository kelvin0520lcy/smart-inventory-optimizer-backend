import { Product } from '@shared/schema';

interface PlatformProduct {
  name: string;
  sku: string;
  description?: string;
  price: string;
  stockQuantity: number;
  category?: string;
}

interface PlatformResponse {
  success: boolean;
  message: string;
  platformId?: string;
  platformUrl?: string;
  error?: any;
}

async function createShopifyProduct(storeUrl: string, accessToken: string, product: PlatformProduct): Promise<PlatformResponse> {
  try {
    const response = await fetch(`https://${storeUrl}/admin/api/2024-01/products.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product: {
          title: product.name,
          body_html: product.description ? `<p>${product.description}</p>` : '',
          vendor: 'Smart Inventory',
          product_type: product.category || 'Default',
          status: 'active',
          published_scope: 'global',
          variants: [{
            sku: product.sku,
            price: product.price,
            inventory_quantity: product.stockQuantity,
            inventory_management: 'shopify',
            inventory_policy: 'deny',
            requires_shipping: true,
            taxable: true,
            weight: 0.0,
            weight_unit: 'kg',
            fulfillment_service: 'manual'
          }]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create Shopify product: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return {
      platformId: data.product.id.toString(),
      platformUrl: `https://${storeUrl}/admin/products/${data.product.id}`,
      success: true,
      message: `Product "${product.name}" created successfully in Shopify`
    };
  } catch (error) {
    console.error('Error creating Shopify product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while creating product in Shopify',
      error: error
    };
  }
}

async function createWooCommerceProduct(storeUrl: string, accessToken: string, product: PlatformProduct): Promise<PlatformResponse> {
  try {
    const response = await fetch(`${storeUrl}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: product.name,
        description: product.description,
        sku: product.sku,
        regular_price: product.price,
        manage_stock: true,
        stock_quantity: product.stockQuantity,
        categories: product.category ? [{ name: product.category }] : []
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create WooCommerce product: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return {
      platformId: data.id.toString(),
      platformUrl: data.permalink,
      success: true,
      message: `Product "${product.name}" created successfully in WooCommerce`
    };
  } catch (error) {
    console.error('Error creating WooCommerce product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while creating product in WooCommerce',
      error: error
    };
  }
}

export async function createProductInPlatform(
  platform: string,
  storeUrl: string,
  accessToken: string,
  product: PlatformProduct
): Promise<PlatformResponse> {
  try {
    switch (platform.toLowerCase()) {
      case 'shopify':
        return await createShopifyProduct(storeUrl, accessToken, product);
      case 'woocommerce':
        return await createWooCommerceProduct(storeUrl, accessToken, product);
      default:
        return {
          success: false,
          message: `Unsupported platform: ${platform}`
        };
    }
  } catch (error) {
    console.error(`Error in createProductInPlatform for ${platform}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : `Unknown error occurred while creating product in ${platform}`,
      error: error
    };
  }
} 