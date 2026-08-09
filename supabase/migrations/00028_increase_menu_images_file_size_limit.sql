-- Increase file size limit from 1 MB to 5 MB for menu-images bucket
UPDATE storage.buckets
SET file_size_limit = 5242880  -- 5 MB in bytes
WHERE id = 'menu-images';