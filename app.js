(() => {
  'use strict';
  const categories = ['Сніданки', 'Обіди', 'Вечері', 'Десерти', 'Вегетаріанські страви'];
  const descriptions = {
    'Сніданки':'Неквапливі ранки та смачний початок дня.',
    'Обіди':'Свіжі й поживні страви для середини дня.',
    'Вечері':'Щось тепле, щоб зібратися за столом.',
    'Десерти':'Маленький привід залишити місце для солодкого.',
    'Вегетаріанські страви':'Овочі та крупи в головній ролі.'
  };
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  // Web3Forms access keys are public aliases tied to the recipients' inboxes.
  // Keep recipient email addresses out of the site source; add one key per inbox.
  const CONTACT_ACCESS_KEYS = ['816b9e7c-d1a3-4ccb-9cd3-fcb6d1df7d83', '15cf6f90-ad7d-4b78-a23f-982701e51a56'];
  const elements = {
    views: $$('[data-view]'), search: $('#search'), category: $('#filter-category'), time: $('#filter-time'),
    difficulty: $('#filter-difficulty'), diet: $('#filter-diet'), sort: $('#sort'), grid: $('#catalog-grid'), count: $('#results-count'),
    empty: $('#catalog-empty'), favoritesGrid: $('#favorites-grid'), favoritesEmpty: $('#favorites-empty'),
    dialog: $('#recipe-dialog'), dialogContent: $('#dialog-content')
  };
  const readStored = (key, fallback) => { try { const value=localStorage.getItem(key); return value===null?fallback:JSON.parse(value); } catch { return fallback; } };
  let favorites = new Set(Array.isArray(readStored('quiet-kitchen-favorites', [])) ? readStored('quiet-kitchen-favorites', []) : []);
  let currentRecipe = null;
  let returnFocus = null;
  let mobileMenuOpen = false;

  function saveFavorites(){ localStorage.setItem('quiet-kitchen-favorites', JSON.stringify([...favorites])); }
  function setTheme(theme){ document.body.dataset.theme=theme; localStorage.setItem('quiet-kitchen-theme',theme); $('#theme-toggle').setAttribute('aria-label',theme==='dark'?'Увімкнути світлу тему':'Увімкнути темну тему'); }
  function initTheme(){ const saved=localStorage.getItem('quiet-kitchen-theme'); setTheme(saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')); }
  function updateFavoriteCount(){ $('#favorite-count').textContent=String(favorites.size); }
  function recipeById(id){ return RECIPES.find(recipe=>recipe.id===id); }
  function imageSource(recipe){ return recipe.image; }
  function recipeImageMarkup(recipe, extra=''){return `<img src="${imageSource(recipe)}" alt="${recipe.name}" ${extra}>`;}
  function cardMarkup(recipe){
    const isFavorite=favorites.has(recipe.id);
    return `<article class="recipe-card"><div class="card-image" data-open-recipe="${recipe.id}" tabindex="0" role="button" aria-label="Відкрити рецепт: ${recipe.name}">${recipeImageMarkup(recipe,'loading="lazy"')}<span class="card-category">${recipe.category}</span><button class="favorite-button" type="button" data-favorite="${recipe.id}" aria-label="${isFavorite?'Прибрати з':'Додати до'} обраного: ${recipe.name}" aria-pressed="${isFavorite}">${isFavorite?'♥':'♡'}</button></div><div class="card-body"><h3 data-open-recipe="${recipe.id}" tabindex="0" role="button">${recipe.name}</h3><p class="card-description">${recipe.description}</p><div class="card-meta"><span>${recipe.time} хв</span><span>${recipe.difficulty}</span><span>≈ ${recipe.kcal} ккал</span></div></div></article>`;
  }
  function attachImageFallback(root){
    $$('img',root).forEach(img=>img.addEventListener('error',()=>{
      const id=img.closest('[data-open-recipe]')?.dataset.openRecipe||currentRecipe?.id;
      const recipe=recipeById(id);
      const fallback=recipe?.fallbackImage||img.dataset.fallback;
      const attempted=img.dataset.fallbackUsed==='true';
      if(fallback&&!attempted&&fallback!==img.currentSrc&&fallback!==img.src){
        img.dataset.fallbackUsed='true';
        img.src=fallback;
        return;
      }
      img.removeAttribute('src');
      img.alt=`Фото страви «${recipe?.name||img.alt}» тимчасово недоступне`;
      img.classList.add('image-unavailable');
    }));
  }
  function updateCards(root){
    $$('.favorite-button',root).forEach(button=>{
      const selected=favorites.has(button.dataset.favorite);
      button.setAttribute('aria-pressed',String(selected));
      button.setAttribute('aria-label',`${selected?'Прибрати з':'Додати до'} обраного: ${recipeById(button.dataset.favorite).name}`);
      button.textContent=selected?'♥':'♡';
    });
  }
  function renderFeatured(){
    const featured=[...RECIPES].sort((a,b)=>b.popularity-a.popularity).slice(0,3);
    $('#home-grid').innerHTML=featured.map(cardMarkup).join('');
    $('#home-categories').innerHTML=categories.map((name,index)=>`<a class="category-chip" href="#recipes" data-category-link="${name}">${name}<span aria-hidden="true"> ↗</span></a>`).join('');
    attachImageFallback($('#home-grid'));
  }
  function renderCategorySelect(){
    elements.category.insertAdjacentHTML('beforeend',categories.map(name=>`<option value="${name}">${name}</option>`).join(''));
    $('#category-list').innerHTML=categories.map((name,index)=>`<a class="category-row" href="#recipes" data-category-link="${name}"><span class="category-number">0${index+1}</span><h2>${name}</h2><p>${descriptions[name]} · ${RECIPES.filter(recipe=>recipe.category===name).length} рецептів</p><span class="category-arrow" aria-hidden="true">↗</span></a>`).join('');
  }
  function matchingRecipes(){
    const query=elements.search.value.trim().toLocaleLowerCase('ru');
    const maxTime=elements.time.value==='all'?Infinity:Number(elements.time.value);
    const filtered=RECIPES.filter(recipe=>{
      const searchable=`${recipe.name} ${recipe.description} ${recipe.category} ${recipe.ingredients.map(item=>item[2]).join(' ')}`.toLocaleLowerCase('uk');
      const diet=elements.diet.value;
      return (!query||searchable.includes(query)) && (elements.category.value==='all'||recipe.category===elements.category.value) && recipe.time<=maxTime && (elements.difficulty.value==='all'||recipe.difficulty===elements.difficulty.value) && (diet==='all'||recipe.diet===diet||(diet==='vegetarian'&&recipe.diet==='vegan'));
    });
    if(elements.sort.value==='name') filtered.sort((a,b)=>a.name.localeCompare(b.name,'uk'));
    if(elements.sort.value==='time') filtered.sort((a,b)=>a.time-b.time||b.popularity-a.popularity);
    if(elements.sort.value==='popular') filtered.sort((a,b)=>b.popularity-a.popularity);
    return filtered;
  }
  function renderCatalog(){
    const results=matchingRecipes();
    elements.count.textContent=`Знайдено рецептів: ${results.length}`;
    elements.grid.innerHTML=results.map(cardMarkup).join('');
    elements.grid.hidden=results.length===0; elements.empty.hidden=results.length!==0;
    attachImageFallback(elements.grid);
  }
  function renderFavorites(){
    const recipes=RECIPES.filter(recipe=>favorites.has(recipe.id)).sort((a,b)=>b.popularity-a.popularity);
    elements.favoritesGrid.innerHTML=recipes.map(cardMarkup).join('');
    elements.favoritesGrid.hidden=recipes.length===0; elements.favoritesEmpty.hidden=recipes.length!==0;
    attachImageFallback(elements.favoritesGrid);
  }
  function route(){
    const routeName=location.hash.slice(1).split('?')[0]||'home';
    const view=['home','recipes','categories','favorites','about','contact'].includes(routeName)?routeName:'home';
    elements.views.forEach(section=>section.classList.toggle('active',section.dataset.view===view));
    $$('[data-route]').forEach(link=>{if(link.dataset.route===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    if(view==='recipes')renderCatalog(); if(view==='favorites')renderFavorites();
    closeMobileMenu(); window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function openRecipe(id, trigger){
    const recipe=recipeById(id); if(!recipe)return;
    currentRecipe=recipe; returnFocus=trigger||document.activeElement;
    elements.dialogContent.innerHTML=`<div class="dialog-hero">${recipeImageMarkup(recipe)}</div><div class="dialog-recipe-body"><p class="eyebrow">${recipe.category} · ${recipe.difficulty}</p><h2 id="dialog-title">${recipe.name}</h2><p class="dialog-description">${recipe.description}</p><div class="dialog-meta"><span>◷ ${recipe.time} хвилин</span><span>♧ ${recipe.difficulty}</span><span>♡ ${recipe.servings} ${pluralServings(recipe.servings)}</span><span>≈ ${recipe.kcal} ккал на порцію</span></div><section class="dialog-section"><h3>Інгредієнти</h3><label class="servings-control" for="serving-count">Кількість порцій <input id="serving-count" type="number" min="1" max="20" step="1" value="${recipe.servings}"></label><ul class="ingredient-list" id="ingredient-list"></ul></section><section class="dialog-section"><h3>Спосіб приготування</h3><ol class="steps-list">${recipe.steps.map(step=>`<li><h4>${step.title}</h4><p>${step.text}</p></li>`).join('')}</ol></section><p class="recipe-storage"><strong>Зберігання:</strong> ${recipe.storage}</p><button class="button button-dark print-button" type="button">Друкувати рецепт</button></div>`;
    renderIngredients(recipe,recipe.servings); attachImageFallback(elements.dialogContent); elements.dialog.showModal(); $('.dialog-close',elements.dialog).focus();
  }
  function pluralServings(number){ const n=number%100; if(n>=11&&n<=14)return 'порцій'; const last=n%10; return last===1?'порція':last>=2&&last<=4?'порції':'порцій'; }
  function formatAmount(value){
    if(!Number.isFinite(value))return String(value);
    const candidates=[[0.25,'¼'],[0.5,'½'],[0.75,'¾'],[1/3,'⅓'],[2/3,'⅔']];
    const whole=Math.floor(value+1e-8),fraction=value-whole;
    const match=candidates.find(([amount])=>Math.abs(amount-fraction)<0.015);
    if(match)return `${whole?whole+' ':''}${match[1]}`;
    return Number(value.toFixed(2)).toLocaleString('uk-UA');
  }
  function renderIngredients(recipe,servings){
    $('#ingredient-list',elements.dialog).innerHTML=recipe.ingredients.map(([quantity,unit,name])=>{
      const amount=quantity===null?unit:formatAmount(quantity*servings/recipe.servings)+(unit?' '+unit:'');
      return `<li><span class="ingredient-amount">${amount}</span> — ${name}</li>`;
    }).join('');
  }
  function closeRecipe(){ if(elements.dialog.open)elements.dialog.close(); }
  function closeMobileMenu(){mobileMenuOpen=false;$('#mobile-nav').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false');$('#menu-toggle').setAttribute('aria-label','Відкрити меню');}
  function resetFilters(){elements.search.value='';elements.category.value='all';elements.time.value='all';elements.difficulty.value='all';elements.diet.value='all';elements.sort.value='popular';renderCatalog();}
  function showCategory(name){elements.category.value=categories.includes(name)?name:'all';elements.search.value='';location.hash='recipes';if(location.hash==='#recipes')renderCatalog();}
  async function validateContact(event){
    event.preventDefault(); const form=event.currentTarget; const status=$('#form-status');status.textContent='';
    const fields=[['name',$('#contact-name'),'Введіть ім’я (не менше 2 символів).'],['email',$('#contact-email'),'Укажіть коректну адресу електронної пошти.'],['message',$('#contact-message'),'Напишіть повідомлення (не менше 10 символів).']];
    let firstInvalid=null;
    fields.forEach(([key,input,message])=>{const error=$(`[data-error="${key}"]`);const invalid=!input.checkValidity();error.textContent=invalid?message:'';input.setAttribute('aria-invalid',String(invalid));if(invalid&&!firstInvalid)firstInvalid=input;});
    if(firstInvalid){firstInvalid.focus();status.textContent='Будь ласка, перевірте позначені поля.';return;}
    const submitButton=$('button[type="submit"]',form);submitButton.disabled=true;status.textContent='Надсилаємо повідомлення…';
    const formValues=Object.fromEntries(new FormData(form));
    const results=await Promise.allSettled(CONTACT_ACCESS_KEYS.map(async accessKey=>{
      const response=await fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({...formValues,access_key:accessKey,replyto:formValues.email})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.success!==true)throw new Error(result.message||'Не вдалося доставити повідомлення.');
      return result;
    }));
    const delivered=results.filter(result=>result.status==='fulfilled').length;
    if(delivered===CONTACT_ACCESS_KEYS.length){form.reset();status.textContent='Дякуємо! Ваше повідомлення надіслано.';}
    else if(delivered>0){status.textContent='Повідомлення доставлено не на всі адреси. Воно могло надійти лише на одну з них; спробуйте ще раз трохи пізніше.';}
    else{status.textContent='Не вдалося надіслати повідомлення. Перевірте підключення до інтернету й спробуйте ще раз.';}
    submitButton.disabled=false;
  }
  function init(){
    initTheme();attachImageFallback(document);renderCategorySelect();renderFeatured();updateFavoriteCount();route();
    $('#theme-toggle').addEventListener('click',()=>setTheme(document.body.dataset.theme==='dark'?'light':'dark'));
    $('#menu-toggle').addEventListener('click',event=>{mobileMenuOpen=!mobileMenuOpen;$('#mobile-nav').hidden=!mobileMenuOpen;event.currentTarget.setAttribute('aria-expanded',String(mobileMenuOpen));event.currentTarget.setAttribute('aria-label',mobileMenuOpen?'Закрити меню':'Відкрити меню');});
    window.addEventListener('hashchange',route);
    [elements.search,elements.category,elements.time,elements.difficulty,elements.diet,elements.sort].forEach(control=>control.addEventListener(control===elements.search?'input':'change',renderCatalog));
    $('#reset-filters').addEventListener('click',resetFilters);$('[data-reset]').addEventListener('click',resetFilters);
    $('#contact-form').addEventListener('submit',validateContact);
    $('#contact-form').addEventListener('input',event=>{const input=event.target;if(input.name){$(`[data-error="${input.name}"]`).textContent='';input.removeAttribute('aria-invalid');$('#form-status').textContent='';}});
    document.addEventListener('click',event=>{
      const favorite=event.target.closest('[data-favorite]');
      if(favorite){event.stopPropagation();const id=favorite.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavorites();updateFavoriteCount();updateCards($('#home-grid'));updateCards(elements.grid);updateCards(elements.favoritesGrid);if(location.hash==='#favorites')renderFavorites();return;}
      const category=event.target.closest('[data-category-link]');if(category){event.preventDefault();showCategory(category.dataset.categoryLink);return;}
      const opener=event.target.closest('[data-open-recipe]');if(opener)openRecipe(opener.dataset.openRecipe,opener);
      if(mobileMenuOpen&&!event.target.closest('#mobile-nav')&&!event.target.closest('#menu-toggle'))closeMobileMenu();
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&location.hash==='#recipes'){event.preventDefault();elements.search.focus();}
      if(event.key==='Enter'&&event.target.matches('[data-open-recipe]'))openRecipe(event.target.dataset.openRecipe,event.target);
    });
    elements.dialog.addEventListener('input',event=>{if(event.target.id==='serving-count'){const input=event.target;const value=Math.max(1,Math.min(20,Math.round(Number(input.value)||1)));input.value=String(value);renderIngredients(currentRecipe,value);}});
    $('.dialog-close',elements.dialog).addEventListener('click',closeRecipe);
    elements.dialog.addEventListener('click',event=>{if(event.target.closest('.print-button'))window.print();});
    elements.dialog.addEventListener('click',event=>{if(event.target===elements.dialog)closeRecipe();});
    elements.dialog.addEventListener('close',()=>{if(returnFocus&&returnFocus.isConnected)returnFocus.focus();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileMenuOpen)closeMobileMenu();});
  }
  init();
})();

