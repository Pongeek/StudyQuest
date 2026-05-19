-- Create storage bucket for course PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-files', 'course-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to course files
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'course-files');

-- Allow authenticated uploads
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'course-files');

-- RPC function for incrementing user XP (used by achievement system)
CREATE OR REPLACE FUNCTION increment_user_xp(p_user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET total_xp = total_xp + amount WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
