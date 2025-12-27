import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create regular client to verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the requesting user
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requesting user is an admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: requestingUser.id,
      _role: 'admin'
    })

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user ID to delete from the request body
    const { userId } = await req.json()
    
    // Validate userId is present and is a string
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate UUID format
    if (!UUID_REGEX.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent admin from deleting themselves
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify target user exists before proceeding
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (getUserError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if target user is an admin (prevent deleting admins)
    const { data: targetIsAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    })

    if (targetIsAdmin) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete admin accounts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Track cleanup errors for logging
    const cleanupErrors: Array<{ table: string; error: string }> = []

    // Clean up related data before deleting user
    // 1. Remove route assignments
    const { error: routeError } = await supabaseAdmin
      .from('routes')
      .update({ assigned_booker_id: null })
      .eq('assigned_booker_id', userId)
    
    if (routeError) {
      cleanupErrors.push({ table: 'routes', error: routeError.message })
    }

    // 2. Delete booker financials
    const { error: financialsError } = await supabaseAdmin
      .from('booker_financials')
      .delete()
      .eq('booker_id', userId)
    
    if (financialsError) {
      cleanupErrors.push({ table: 'booker_financials', error: financialsError.message })
    }

    // 3. Delete returns
    const { error: returnsError } = await supabaseAdmin
      .from('returns')
      .delete()
      .eq('booker_id', userId)
    
    if (returnsError) {
      cleanupErrors.push({ table: 'returns', error: returnsError.message })
    }

    // 4. Delete order items for user's orders
    const { data: userOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('booker_id', userId)
    
    if (userOrders && userOrders.length > 0) {
      const orderIds = userOrders.map(o => o.id)
      const { error: orderItemsError } = await supabaseAdmin
        .from('order_items')
        .delete()
        .in('order_id', orderIds)
      
      if (orderItemsError) {
        cleanupErrors.push({ table: 'order_items', error: orderItemsError.message })
      }
    }

    // 5. Delete orders
    const { error: ordersError } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('booker_id', userId)
    
    if (ordersError) {
      cleanupErrors.push({ table: 'orders', error: ordersError.message })
    }

    // 6. Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
    
    if (rolesError) {
      cleanupErrors.push({ table: 'user_roles', error: rolesError.message })
    }

    // 7. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId)
    
    if (profileError) {
      cleanupErrors.push({ table: 'profiles', error: profileError.message })
    }

    // Log any cleanup errors
    if (cleanupErrors.length > 0) {
      console.warn('Cleanup errors during user deletion:', cleanupErrors)
    }

    // 8. Finally delete the user from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
