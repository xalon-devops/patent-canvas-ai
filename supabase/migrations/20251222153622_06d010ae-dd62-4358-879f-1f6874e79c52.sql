-- Create a function to fetch database schema for analysis
-- Uses plpgsql to avoid correlated subquery issues
CREATE OR REPLACE FUNCTION public.get_database_schema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'tables', COALESCE((
      SELECT jsonb_agg(table_info ORDER BY table_info->>'table_name')
      FROM (
        SELECT jsonb_build_object(
          'table_name', t.table_name,
          'columns', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'column_name', c.column_name,
                'data_type', c.data_type,
                'is_nullable', c.is_nullable,
                'column_default', c.column_default
              )
              ORDER BY c.ordinal_position
            )
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' 
              AND c.table_name = t.table_name
          ), '[]'::jsonb)
        ) as table_info
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
      ) sub
    ), '[]'::jsonb),
    'rls_enabled', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'table_name', relname::text,
          'rls_enabled', relrowsecurity
        )
      )
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relkind = 'r'
    ), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_database_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_schema() TO anon;