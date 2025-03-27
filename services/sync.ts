import { Product, Integration } from '@shared/schema';
import { SHOPIFY_API_VERSION } from '../config';

interface ShopifyProduct {
  product: {
    variants: Array<{
      inventory_item_id: string;
    }>;
  };
}

interface ShopifyLocations {
  locations: Array<{
    id: string;
  }>;
}

class SyncService {
  async syncProductToShopify(product: Product, integration: Integration): Promise<void> {
    if (!integration.accessToken || !integration.storeUrl) {
      throw new Error('Integration missing required credentials');
    }

    try {
      const response = await fetch(
        `https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${product.platformIds?.[0]}.json`,
        {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': integration.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product: {
              id: product.platformIds?.[0],
              title: product.name,
              body_html: product.description ? `<p>${product.description}</p>` : '',
              vendor: 'Smart Inventory',
              product_type: product.category || 'Default',
              variants: [{
                price: product.price,
                sku: product.sku,
                inventory_management: 'shopify',
                inventory_quantity: product.stockQuantity
              }]
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to sync product to Shopify: ${response.statusText}`);
      }

      console.log(`Successfully synced product ${product.name} to Shopify`);
    } catch (error) {
      console.error('Error syncing product to Shopify:', error);
      throw error;
    }
  }

  async syncInventoryToShopify(product: Product, integration: Integration): Promise<void> {
    if (!integration.accessToken || !integration.storeUrl) {
      throw new Error('Integration missing required credentials');
    }

    try {
      // First, get the inventory item ID
      const productResponse = await fetch(
        `https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${product.platformIds?.[0]}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': integration.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!productResponse.ok) {
        throw new Error(`Failed to fetch Shopify product: ${productResponse.statusText}`);
      }

      const productData = await productResponse.json() as ShopifyProduct;
      const variant = productData.product.variants[0];
      const inventoryItemId = variant.inventory_item_id;

      // Get locations
      const locationsResponse = await fetch(
        `https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/locations.json`,
        {
          headers: {
            'X-Shopify-Access-Token': integration.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!locationsResponse.ok) {
        throw new Error(`Failed to fetch Shopify locations: ${locationsResponse.statusText}`);
      }

      const locationsData = await locationsResponse.json() as ShopifyLocations;
      const locationId = locationsData.locations[0].id;

      // Update inventory level
      const updateResponse = await fetch(
        `https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': integration.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inventory_item_id: inventoryItemId,
            location_id: locationId,
            available: product.stockQuantity
          })
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Failed to update Shopify inventory: ${updateResponse.statusText}`);
      }

      console.log(`Successfully updated Shopify inventory for product ${product.name}`);
    } catch (error) {
      console.error('Error syncing inventory to Shopify:', error);
      throw error;
    }
  }
}

export const syncService = new SyncService(); 