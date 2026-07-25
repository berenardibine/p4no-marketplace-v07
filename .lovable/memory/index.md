p4no marketplace app - rebranded from Smart Market. React/Vite/Tailwind/Supabase.

## Brand
- Name: p4no
- Slogan: Built for the Next Generation of Trade
- Logo: src/assets/logo.png (also public/logo.png)
- Favicon: /logo.png (PNG format)

## Image Upload System
- ALL image uploads use Cloudinary (cloud_name: ddwrviw3v, preset: smart_market_upload)
- Utility: src/lib/cloudinary.ts (upload, optimize URL, thumbnails)
- Hook: src/hooks/useCloudinaryUpload.tsx
- Component: src/components/ui/cloudinary-image.tsx
- Videos still use Supabase storage
- Supabase DB stores only Cloudinary URLs

## Design
- Uses shadcn/ui components with semantic tokens
- Mobile-first marketplace UI
