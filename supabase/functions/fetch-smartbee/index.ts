const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  return new Response(
    JSON.stringify({ success: false, error: "TEST_D_ECHO" }), 
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
