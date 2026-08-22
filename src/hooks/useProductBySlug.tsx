import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './useProducts';
import { resolveProductDetail } from '@/lib/productCache';
import { waitForPath } from '@/lib/staticCDN';
import { productStaticPath } from '@/lib/productShard';
import { coalesce } from '@/lib/stampede';
import { recordTraffic } from '@/lib/trafficTelemetry';


export type ProductStatus = 'loading' | 'found' | 'not_found' | 'error';

// Cold-start protection: a fresh device has no memory/IDB copy, so the very
// first static read is the only thing standing between the visitor and the
// page. Transient failures are retried before we conclude anything.
const RESOLVE_RETRIES = [400, 1200, 2500] as const;

export const useProductBySlug = (slugOrId: string | undefined) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<ProductStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSlugBased, setIsSlugBased] = useState(false);
  const runId = useRef(0);

  const fetchProduct = useCallback(async () => {
    if (!slugOrId) {
      setStatus('error');
      setError('No product identifier provided');
      return;
    }

    const id = ++runId.current;
    const alive = () => runId.current === id;
    const startedAt = Date.now();

    setStatus('loading');
    setError(null);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    setIsSlugBased(!isUUID);

    let lastOutcome: 'hit' | 'missing' | 'unavailable' | 'blocked' = 'unavailable';

    // 1) Static delivery layer: memory → browser cache → IndexedDB → CDN.
    for (let attempt = 0; attempt <= RESOLVE_RETRIES.length; attempt++) {
      let resolved: Awaited<ReturnType<typeof resolveProductDetail>>;
      try {
        resolved = await resolveProductDetail(slugOrId);
      } catch {
        resolved = { product: null, outcome: 'unavailable', path: '' };
      }
      if (!alive()) return;
      lastOutcome = resolved.outcome;

      if (resolved.product) {
        setProduct(resolved.product as unknown as Product);
        setStatus('found');
        return;
      }
      // A definitive miss needs no retry loop — go straight to the queue check.
      if (resolved.outcome === 'missing' || resolved.outcome === 'blocked') break;
      if (attempt < RESOLVE_RETRIES.length) {
        await new Promise((r) => setTimeout(r, RESOLVE_RETRIES[attempt]));
      }
    }

    // 2) Definitively absent from the manifest? It may have been published a
    //    moment ago — ask the generator queue and wait for the manifest bump.
    //    A delivery failure ('unavailable') is NOT queue-related, so we never
    //    spend the edge-function round trip on it.
    if (lastOutcome === 'missing') {
      try {
        const built = await waitForPath(await productStaticPath(slugOrId), 4000);
        if (built) {
          const retry = await resolveProductDetail(slugOrId);
          if (!alive()) return;
          if (retry.product) {
            setProduct(retry.product as unknown as Product);
            setStatus('found');
            return;
          }
          lastOutcome = retry.outcome;
        }
      } catch { /* fall through */ }
    }

    // 3) Static delivery could not produce the product. A visitor must still be
    //    able to read the page, so a SINGLE coalesced database read is allowed
    //    as the genuine last resort — even in strict mode. It is deduplicated
    //    per slug by the stampede guard, so a traffic spike cannot turn this
    //    into an egress problem.
    if (!alive()) return;
    recordTraffic({
      path: `product-detail/${slugOrId}`,
      layer: 'memory',
      bytes: 0,
      ms: Date.now() - startedAt,
      at: Date.now(),
      missReason: `product-detail-${lastOutcome}`,
    });
    if (lastOutcome === 'blocked') {
      setProduct(null);
      setError('Product not found');
      setStatus('not_found');
      return;
    }


    // 4) Last-resort database read — one shared query per slug.
    try {
      const { data, error: fetchError } = await coalesce(
        `product-detail-db:${slugOrId}`,
        async () => {
          let query = supabase
            .from('products')
            .select(`
              *,
              seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number, identity_verified),
              shop:shops(id, name, logo_url, trading_center, slug)
            `);

          if (isUUID) query = query.eq('id', slugOrId);
          else query = query.eq('slug', slugOrId);

          return query.maybeSingle();
        },
      );
      if (!alive()) return;


      recordTraffic({
        path: `product-detail/${slugOrId}`,
        layer: 'db',
        bytes: 0,
        ms: Date.now() - startedAt,
        at: Date.now(),
        missReason: `product-detail-${lastOutcome}`,
      });

      if (fetchError) {
        setError(fetchError.message);
        setProduct(null);
        setStatus('error');
        return;
      }
      if (!data) {
        setError('Product not found');
        setProduct(null);
        setStatus('not_found');
        return;
      }
      setProduct(data as unknown as Product);
      setStatus('found');
    } catch (err: any) {
      if (!alive()) return;
      setError(err?.message || 'Failed to load product');
      setProduct(null);
      setStatus('error');
    }
  }, [slugOrId]);

  useEffect(() => {
    if (slugOrId) void fetchProduct();
  }, [slugOrId, fetchProduct]);

  return {
    product,
    loading: status === 'loading',
    status,
    error: status === 'not_found' || status === 'error' ? error : null,
    notFound: status === 'not_found',
    isSlugBased,
    refetch: fetchProduct,
  };
};
