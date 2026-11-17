let supabaseClient = null;
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');
function message(id, text){ $(id).textContent = text || ''; }

function connect(){
  const url = localStorage.getItem('fm_project_url');
  const key = localStorage.getItem('fm_publishable_key');
  if(url && key && window.supabase){
    supabaseClient = window.supabase.createClient(url, key);
    return true;
  }
  return false;
}
function setupView(){
  $('projectUrl').value = localStorage.getItem('fm_project_url') || '';
  $('publishableKey').value = localStorage.getItem('fm_publishable_key') || '';
  show('setup'); hide('auth'); hide('dashboard');
}
$('settingsBtn').addEventListener('click', setupView);
$('saveSetup').addEventListener('click', () => {
  const url = $('projectUrl').value.trim();
  const key = $('publishableKey').value.trim();
  if(!url.startsWith('https://') || !url.includes('.supabase.co') || !key){
    message('setupMsg','Please enter a valid Supabase project URL and publishable key.');
    return;
  }
  localStorage.setItem('fm_project_url',url);
  localStorage.setItem('fm_publishable_key',key);
  connect();
  message('setupMsg','Connection details saved on this device.');
  hide('setup'); show('auth');
});
$('adminTab').addEventListener('click', () => {
  $('adminTab').classList.add('active'); $('influencerTab').classList.remove('active');
  show('adminForm'); hide('influencerForm');
});
$('influencerTab').addEventListener('click', () => {
  $('influencerTab').classList.add('active'); $('adminTab').classList.remove('active');
  show('influencerForm'); hide('adminForm');
});
async function loadDashboard(user){
  hide('auth'); hide('setup'); show('dashboard');
  $('hello').textContent = 'Welcome';
  $('roleText').textContent = user.email || user.phone || 'Signed in';
  message('connectionStatus','Signed in. Checking your public.profiles record…');
  const {data,error} = await supabaseClient.from('profiles').select('role,full_name').eq('id',user.id).maybeSingle();
  if(error){
    message('connectionStatus','Login worked, but profile lookup failed: '+error.message+'. Check that profiles.id matches auth.users.id and that your RLS policies allow the user to read their own profile.');
    return;
  }
  if(!data){
    message('connectionStatus','Login worked, but no profile row was found for this user. Ask the admin to create/link the profile before using the dashboard.');
    return;
  }
  $('hello').textContent = data.full_name ? 'Welcome, '+data.full_name : 'Welcome';
  $('roleText').textContent = 'Role: '+(data.role || 'not assigned');
  message('connectionStatus','Supabase connection and profile lookup successful. This is the first working shell; campaign, visit, proof and payment workflows still need to be built and tested.');
}
$('adminLogin').addEventListener('click', async () => {
  if(!connect()){message('authMsg','Tap Setup first and connect your Supabase project.');return;}
  message('authMsg','Signing in…');
  const {data,error}=await supabaseClient.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  if(error){message('authMsg',error.message);return;}
  await loadDashboard(data.user);
});
$('sendOtp').addEventListener('click', async () => {
  if(!connect()){message('authMsg','Tap Setup first and connect your Supabase project.');return;}
  const phone=$('phone').value.trim();
  if(!phone){message('authMsg','Enter your phone number with country code, e.g. +91…');return;}
  message('authMsg','Sending OTP…');
  const {error}=await supabaseClient.auth.signInWithOtp({phone});
  message('authMsg',error ? error.message : 'OTP request sent. Check your SMS.');
});
$('verifyOtp').addEventListener('click', async () => {
  if(!connect()){message('authMsg','Tap Setup first and connect your Supabase project.');return;}
  const {data,error}=await supabaseClient.auth.verifyOtp({phone:$('phone').value.trim(),token:$('otp').value.trim(),type:'sms'});
  if(error){message('authMsg',error.message);return;}
  await loadDashboard(data.user);
});
$('logout').addEventListener('click', async () => {
  if(supabaseClient) await supabaseClient.auth.signOut();
  hide('dashboard');show('auth');message('authMsg','You have signed out.');
});
if(connect()){
  supabaseClient.auth.getSession().then(({data})=>{if(data.session) loadDashboard(data.session.user);});
}
