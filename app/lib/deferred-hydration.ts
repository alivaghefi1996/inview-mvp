// A visitor document carries about 140 KB of module scripts. Nothing blocks the paint, but the
// Lighthouse mobile profile shares 1.6 Mbit/s between every request in flight, so those scripts
// take the bandwidth the fonts and the first card image need. ADR 0009 keeps the scripts and
// starts them after the load event instead. The server rewrites these two attribute values so
// the browser ignores the markup React Router wrote, and the script below puts it back to work.

export const DEFERRED_SCRIPT_TYPE = 'inview/deferred-module'
export const DEFERRED_PRELOAD_REL = 'inview-deferred-modulepreload'

/** `<html>` carries this once React has hydrated. */
export const HYDRATED_ATTRIBUTE = 'data-hydrated'

export const HYDRATION_BOOTSTRAP = `(function(){
var source=document.querySelector('script[type="${DEFERRED_SCRIPT_TYPE}"]');
if(!source)return;
var missed=null;
function remember(event){
var target=event.target;
var button=target&&target.closest&&target.closest('button');
if(button&&!button.form)missed=button;
}
function replay(){
document.removeEventListener('click',remember,true);
if(missed&&missed.isConnected)missed.click();
missed=null;
}
function run(){
var watch=new MutationObserver(function(){
if(!document.documentElement.hasAttribute('${HYDRATED_ATTRIBUTE}'))return;
watch.disconnect();replay();
});
watch.observe(document.documentElement,{attributes:true,attributeFilter:['${HYDRATED_ATTRIBUTE}']});
var live=document.createElement('script');
live.type='module';
live.textContent=source.textContent;
document.body.appendChild(live);
}
document.addEventListener('click',remember,true);
if(document.readyState==='complete')run();
else addEventListener('load',run,{once:true});
})()`
