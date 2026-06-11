import { createClient } from '@supabase/supabase-js';

// ✅ PON AQUÍ LA URL QUE COPIES DE SUPABASE (NO manual)
const supabaseUrl = 'https://xyueasilwwcewezhkkez.supabase.co';

// ✅ este sí ya está bien ✅
const supabaseAnonKey = 'sb_publishable_uKmATPyiBr7Fqxi-bSgTdw_f7c371Vh';

// ✅ cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
