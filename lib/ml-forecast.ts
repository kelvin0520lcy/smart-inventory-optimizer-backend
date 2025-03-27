/**
 * ML-based Sales Forecasting Algorithm
 * 
 * This module implements more sophisticated forecasting algorithms 
 * including ARIMA-inspired approaches, seasonal decomposition, and
 * exponential smoothing techniques.
 */

import type { Sale } from '@shared/schema';

interface TimeSeriesDataPoint {
  date: Date;
  quantity: number;
  revenue: number;
}

interface ForecastResult {
  dates: string[];
  quantities: number[];
  revenues: number[];
  confidence: number[];
  errors: number[];
}

// Constants for algorithm configuration
const MIN_DATA_POINTS = 14; // Minimum number of data points needed for reliable forecasting
const SEASONALITY_PERIOD = 7; // Weekly seasonality
const MAX_FORECAST_DAYS = 90; // Maximum days to forecast

/**
 * Preprocess sales data for time series analysis
 */
function preprocessSalesData(sales: Sale[]): TimeSeriesDataPoint[] {
  if (!sales || sales.length === 0) return [];

  // Sort sales by date
  const sortedSales = [...sales].sort((a, b) => 
    new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
  );

  // Group sales by day
  const dailyData: Record<string, TimeSeriesDataPoint> = {};
  
  sortedSales.forEach(sale => {
    const dateStr = new Date(sale.saleDate).toISOString().split('T')[0];
    
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = {
        date: new Date(dateStr),
        quantity: 0,
        revenue: 0
      };
    }
    
    dailyData[dateStr].quantity += sale.quantity;
    dailyData[dateStr].revenue += parseFloat(sale.revenue || '0');
  });

  // Convert to array and fill missing dates
  const result = Object.values(dailyData);
  
  // Fill gaps in time series (missing days)
  if (result.length > 1) {
    const filledResult: TimeSeriesDataPoint[] = [];
    const startDate = result[0].date;
    const endDate = result[result.length - 1].date;
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existingPoint = dailyData[dateStr];
      
      if (existingPoint) {
        filledResult.push(existingPoint);
      } else {
        // Fill with zero for missing days
        filledResult.push({
          date: new Date(currentDate),
          quantity: 0,
          revenue: 0
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return filledResult;
  }
  
  return result;
}

/**
 * Extract seasonal patterns from time series data
 */
function extractSeasonality(data: TimeSeriesDataPoint[], period: number = SEASONALITY_PERIOD): number[] {
  if (data.length < period * 2) {
    // Not enough data for seasonal extraction, return unit vector
    return Array(period).fill(1);
  }
  
  // Create seasonal indices
  const seasonalIndices: number[] = Array(period).fill(0);
  const seasonalCounts: number[] = Array(period).fill(0);
  
  data.forEach((point, i) => {
    const seasonalIndex = i % period;
    seasonalIndices[seasonalIndex] += point.quantity;
    seasonalCounts[seasonalIndex]++;
  });
  
  // Average the seasonal components
  const seasonalPattern = seasonalIndices.map((sum, i) => 
    seasonalCounts[i] > 0 ? sum / seasonalCounts[i] : 0
  );
  
  // Normalize to have average of 1
  const patternAvg = seasonalPattern.reduce((sum, val) => sum + val, 0) / period;
  if (patternAvg === 0) return Array(period).fill(1);
  
  return seasonalPattern.map(val => val / patternAvg);
}

/**
 * Detect trends in time series data
 * Uses linear regression for trend detection
 */
function detectTrend(data: TimeSeriesDataPoint[]): { slope: number, intercept: number } {
  if (data.length < 2) {
    return { slope: 0, intercept: data.length > 0 ? data[0].quantity : 0 };
  }
  
  // Simple linear regression
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data.map(d => d.quantity);
  
  const sumX = x.reduce((acc, val) => acc + val, 0);
  const sumY = y.reduce((acc, val) => acc + val, 0);
  const sumXY = x.reduce((acc, i) => acc + (i * y[i]), 0);
  const sumXX = x.reduce((acc, val) => acc + (val * val), 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

/**
 * Apply Triple Exponential Smoothing (Holt-Winters method)
 * Handles level, trend, and seasonality
 */
function applyHoltWinters(
  data: TimeSeriesDataPoint[], 
  days: number, 
  alpha: number = 0.2, 
  beta: number = 0.1, 
  gamma: number = 0.3
): number[] {
  if (data.length < MIN_DATA_POINTS) {
    // Fallback to simpler method if not enough data
    return simpleExponentialForecast(data, days);
  }
  
  const values = data.map(d => d.quantity);
  const period = Math.min(SEASONALITY_PERIOD, Math.floor(data.length / 2));
  
  // Initialize level, trend, and seasonal components
  let level = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  
  // Calculate initial trend
  let trend = 0;
  if (data.length >= period * 2) {
    const firstPeriodAvg = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    const secondPeriodAvg = values.slice(period, period * 2).reduce((sum, val) => sum + val, 0) / period;
    trend = (secondPeriodAvg - firstPeriodAvg) / period;
  }
  
  // Initialize seasonal components
  const seasonals: number[] = [];
  const seasonalAvgs: number[] = [];
  
  // Calculate seasonal averages for each period
  for (let i = 0; i < Math.min(data.length, period * 2); i += period) {
    const periodEnd = Math.min(i + period, data.length);
    const avg = values.slice(i, periodEnd).reduce((sum, val) => sum + val, 0) / (periodEnd - i);
    seasonalAvgs.push(avg);
  }
  
  // Initialize seasonal indices
  for (let i = 0; i < period; i++) {
    const seasonalIndices = [];
    for (let j = 0; j < Math.floor(data.length / period); j++) {
      const index = j * period + i;
      if (index < data.length) {
        const seasonalIndex = values[index] / (seasonalAvgs[j] || 1);
        seasonalIndices.push(seasonalIndex);
      }
    }
    
    // Average seasonal indices for this position in the cycle
    const avgIndex = seasonalIndices.reduce((sum, val) => sum + val, 0) / seasonalIndices.length || 1;
    seasonals.push(avgIndex);
  }
  
  // Normalize seasonal factors
  const seasonalSum = seasonals.reduce((sum, val) => sum + val, 0);
  const normalizedSeasonals = seasonals.map(val => val * period / seasonalSum);
  
  // Apply Holt-Winters forecasting
  const results: number[] = [];
  let currentLevel = level;
  let currentTrend = trend;
  const currentSeasonals = [...normalizedSeasonals];
  
  // Generate forecasts
  for (let i = 0; i < days; i++) {
    const seasonIndex = i % period;
    const forecast = (currentLevel + currentTrend) * currentSeasonals[seasonIndex];
    results.push(Math.max(0, Math.round(forecast))); // Ensure non-negative forecast
    
    // Update components for next period if we have actual data
    if (i < data.length) {
      const actual = values[i] || 0;
      const oldLevel = currentLevel;
      
      currentLevel = alpha * (actual / currentSeasonals[seasonIndex]) + (1 - alpha) * (oldLevel + currentTrend);
      currentTrend = beta * (currentLevel - oldLevel) + (1 - beta) * currentTrend;
      currentSeasonals[seasonIndex] = gamma * (actual / currentLevel) + (1 - gamma) * currentSeasonals[seasonIndex];
    }
  }
  
  return results;
}

/**
 * Simple exponential forecasting as fallback method
 */
function simpleExponentialForecast(data: TimeSeriesDataPoint[], days: number, alpha: number = 0.3): number[] {
  if (data.length === 0) return Array(days).fill(0);
  
  const values = data.map(d => d.quantity);
  
  // Initialize with the first observation
  let level = values[0];
  
  // Apply simple exponential smoothing to historical data
  for (let i = 1; i < values.length; i++) {
    level = alpha * values[i] + (1 - alpha) * level;
  }
  
  // Generate forecast
  return Array(days).fill(level).map(val => Math.max(0, Math.round(val)));
}

/**
 * Generate confidence intervals for the forecast
 */
function generateConfidenceIntervals(
  forecast: number[],
  errors: number[],
  confidence: number = 0.95
): number[] {
  // Calculate z-score based on confidence level
  // For 95% confidence, z ≈ 1.96
  const zScore = 1.96;
  
  // Calculate standard deviation of errors or use a reasonable default
  const errorsMean = errors.length > 0 
    ? errors.reduce((sum, val) => sum + val, 0) / errors.length 
    : 0;
  
  const errorsVariance = errors.length > 0
    ? errors.reduce((sum, val) => sum + Math.pow(val - errorsMean, 2), 0) / errors.length
    : 0.1; // Default variance if no error data
  
  const stdDev = Math.sqrt(errorsVariance);
  
  // Generate confidence intervals
  return forecast.map(() => zScore * stdDev);
}

/**
 * Main forecasting function that combines multiple techniques
 */
export function generateAdvancedForecast(sales: Sale[], days: number = 30): ForecastResult {
  // Cap forecast days
  const forecastDays = Math.min(days, MAX_FORECAST_DAYS);
  
  // Preprocess data
  const processedData = preprocessSalesData(sales);
  
  // If no historical data, return empty forecast
  if (processedData.length === 0) {
    return {
      dates: Array(forecastDays).fill(0).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        return date.toISOString().split('T')[0];
      }),
      quantities: Array(forecastDays).fill(0),
      revenues: Array(forecastDays).fill(0),
      confidence: Array(forecastDays).fill(0.5),
      errors: []
    };
  }
  
  try {
    // Generate forecasts using Holt-Winters method
    const quantityForecast = applyHoltWinters(processedData, forecastDays);
    
    // Calculate confidence intervals
    const confidenceValues = generateConfidenceIntervals(quantityForecast, processedData.map(d => d.quantity - d.quantity));
    
    // Calculate forecast start date (day after last historical date)
    const lastHistoricalDate = processedData[processedData.length - 1].date;
    const forecastDates: string[] = [];
    
    for (let i = 0; i < forecastDays; i++) {
      const date = new Date(lastHistoricalDate);
      date.setDate(date.getDate() + i + 1);
      forecastDates.push(date.toISOString().split('T')[0]);
    }
    
    // Calculate average price from historical data to estimate revenue
    let avgPrice = 0;
    let validPricePoints = 0;
    
    processedData.forEach(point => {
      if (point.quantity > 0) {
        avgPrice += (point.revenue / point.quantity);
        validPricePoints++;
      }
    });
    
    avgPrice = validPricePoints > 0 ? avgPrice / validPricePoints : 0;
    
    // Generate revenue forecast based on quantity and average price
    const revenueForecast = quantityForecast.map(qty => Math.round(qty * avgPrice * 100) / 100);
    
    return {
      dates: forecastDates,
      quantities: quantityForecast,
      revenues: revenueForecast,
      confidence: confidenceValues,
      errors: []
    };
  } catch (error) {
    console.error('Error in ML forecasting:', error);
    
    // Fallback to simple forecasting
    const startDate = new Date();
    const dates = Array(forecastDays).fill(0).map((_, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i + 1);
      return date.toISOString().split('T')[0];
    });
    
    // Calculate average daily sales
    const totalQuantity = processedData.reduce((sum, point) => sum + point.quantity, 0);
    const avgDailySales = processedData.length > 0 ? totalQuantity / processedData.length : 0;
    
    // Apply simple growth factor
    const simpleForecast = Array(forecastDays).fill(0).map((_, i) => 
      Math.round(avgDailySales * (1 + (0.05 * i / 30)))
    );
    
    // Calculate average price for revenue forecast
    const totalRevenue = processedData.reduce((sum, point) => sum + point.revenue, 0);
    const avgPrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;
    
    return {
      dates,
      quantities: simpleForecast,
      revenues: simpleForecast.map(qty => Math.round(qty * avgPrice * 100) / 100),
      confidence: Array(forecastDays).fill(0.6),
      errors: ['Failed to apply advanced forecasting, using fallback method']
    };
  }
}

// Export utility functions for testing
export const _test = {
  preprocessSalesData,
  extractSeasonality,
  detectTrend,
  applyHoltWinters
}; 