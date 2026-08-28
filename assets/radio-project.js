(()=>{
  const pwaUrl='https://ssgpt14-radio-web.onrender.com/';
  const actionRow=document.querySelector('.action-row');
  if(!actionRow)return;
  if(actionRow.querySelector('[data-radio-pwa]'))return;
  const link=document.createElement('a');
  link.className='btn';
  link.href=pwaUrl;
  link.target='_blank';
  link.rel='noopener';
  link.dataset.radioPwa='true';
  link.textContent='PWA ↗';
  actionRow.prepend(link);
})();
