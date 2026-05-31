import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for location searches
const cache = new Map<string, { results: any[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const cacheKey = query.toLowerCase().trim();
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ results: cached.results, cached: true });
    }

    // Call Nominatim API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '10',
          // Nominatim requires a User-Agent
        }),
      {
        headers: {
          'User-Agent': 'GimmeJob/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Nominatim');
    }

    const data = await response.json();

    // Transform Nominatim results to our format with cleaner labels
    const results = data.map((item: any) => {
      const address = item.address || {};
      
      // Build a cleaner location string without county
      const parts = [];
      
      // City/Town/Village
      if (address.city) parts.push(address.city);
      else if (address.town) parts.push(address.town);
      else if (address.village) parts.push(address.village);
      else if (address.municipality) parts.push(address.municipality);
      
      // State/Region
      if (address.state) parts.push(address.state);
      else if (address.region) parts.push(address.region);
      
      // Country code (abbreviation) instead of full name
      if (address.country_code) {
        parts.push(address.country_code.toUpperCase());
      }
      
      const label = parts.length > 0 ? parts.join(', ') : item.display_name;
      
      return {
        label,
        value: label,
        lat: item.lat,
        lon: item.lon,
        type: item.type,
      };
    });

    // Store in cache
    cache.set(cacheKey, { results, timestamp: Date.now() });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching locations:', error);
    return NextResponse.json(
      { error: 'Failed to search locations', results: [] },
      { status: 500 }
    );
  }
}
