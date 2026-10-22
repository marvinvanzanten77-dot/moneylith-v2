export function registerAppWorker(){
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{
      // The online application remains usable when installation is unavailable.
    });
  },{once:true});
}
