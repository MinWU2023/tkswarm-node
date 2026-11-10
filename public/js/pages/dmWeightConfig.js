(function () {
  if (!window.app) throw new Error('app-core must load before pages/dmWeightConfig.js');
  const __methods = {
    canManageDmWeightConfig(){
      if(!this.authEnabled)return true;
      // 仅登录超管（不受身份切换影响）
      return !!this.authIsSuper || Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1;
    },
    dmWeightRangeRowHtml(row={}, idx=0){
      const from=row.dayFrom??row.day_from??0;
      const toRaw=row.dayTo??row.day_to;
      const to=(toRaw===null||toRaw===undefined||toRaw==='')?'':String(toRaw);
      const lim=row.dailyDmLimit??row.daily_dm_limit??1;
      return `<tr class="dm-weight-row" data-idx="${idx}">
        <td><input class="input dm-weight-input" type="number" min="0" name="dayFrom" value="${this.esc(String(from))}" title="起始激活天数（含）"></td>
        <td><input class="input dm-weight-input" type="number" min="0" name="dayTo" value="${this.esc(to)}" placeholder="无上限" title="结束激活天数（含）；留空表示无上限"></td>
        <td><input class="input dm-weight-input" type="number" min="1" name="dailyDmLimit" value="${this.esc(String(lim))}" title="日私信次数"></td>
        <td class="dm-weight-ops"><button type="button" class="tiny ghost is-danger" onclick="app.removeDmWeightRangeRow(this)">删除</button></td>
      </tr>`;
    },
    collectDmWeightRangesFromForm(){
      const rows=[];
      document.querySelectorAll('#dm-weight-range-rows tr.dm-weight-row').forEach((tr)=>{
        const dayFrom=Number(tr.querySelector('[name=dayFrom]')?.value||0);
        const toEl=tr.querySelector('[name=dayTo]');
        const toRaw=String(toEl?.value??'').trim();
        const dayTo=toRaw===''?null:Number(toRaw);
        const dailyDmLimit=Number(tr.querySelector('[name=dailyDmLimit]')?.value||1);
        rows.push({dayFrom, dayTo, dailyDmLimit});
      });
      return rows;
    },
    addDmWeightRangeRow(seed){
      const tbody=document.querySelector('#dm-weight-range-rows');
      if(!tbody)return;
      const i=tbody.querySelectorAll('tr').length;
      const last=tbody.querySelector('tr:last-child');
      let nextFrom=0;
      if(last){
        const lastTo=String(last.querySelector('[name=dayTo]')?.value||'').trim();
        const lastFrom=Number(last.querySelector('[name=dayFrom]')?.value||0);
        nextFrom=lastTo!==''?Number(lastTo)+1:lastFrom+1;
      }
      const useSeed=seed&&typeof seed==='object'&&!(seed instanceof Event)
        &&(seed.dayFrom!=null||seed.dailyDmLimit!=null||seed.day_from!=null);
      const row=useSeed?seed:{dayFrom:nextFrom, dayTo:'', dailyDmLimit:1};
      tbody.insertAdjacentHTML('beforeend', this.dmWeightRangeRowHtml(row, i));
    },
    removeDmWeightRangeRow(btn){
      const tbody=document.querySelector('#dm-weight-range-rows');
      if(!tbody)return;
      const tr=btn?.closest?.('tr');
      if(tr)tr.remove();
      if(!tbody.querySelector('tr')) this.addDmWeightRangeRow({dayFrom:0, dayTo:'', dailyDmLimit:1});
    },
    async renderDmWeightConfig(){
      const host=document.querySelector('#content');
      if(!host)return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(!this.canManageDmWeightConfig()){
        host.innerHTML=`<div class="panel"><div class="empty">仅超级管理员可访问日私信权重配置</div></div>`;
        return;
      }
      try{
        const pack=await this.api('/dm-weight-config');
        const ranges=Array.isArray(pack?.ranges)&&pack.ranges.length
          ? pack.ranges
          : (Array.isArray(pack?.defaultRanges)?pack.defaultRanges:[{dayFrom:0, dayTo:null, dailyDmLimit:1}]);
        const rowsHtml=ranges.map((r,i)=>this.dmWeightRangeRowHtml(r,i)).join('');
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left">
                <span class="muted">开发管理 · 系统默认日私信权重（按视频激活天数）</span>
              </div>
              <div class="right" style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="ghost tiny" type="button" onclick="app.resetDmWeightConfig()">恢复默认</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <form id="dm-weight-config-form" class="settings-form settings-form--full" style="width:100%;max-width:none;padding:8px 4px 24px;box-sizing:border-box">
              <div class="settings-card" style="border:none;box-shadow:none;padding:0;width:100%">
                <p class="muted" style="margin:0 0 12px;line-height:1.55">
                  按账号<strong>首次发视频成功</strong>起算的激活天数匹配区间，决定当日私信上限。
                  未发视频账号固定 1 条/天。结束天数留空表示「及以上」。保存后写入
                  <code>account_video_weight_tiers</code>（owner_id=0），并刷新当日额度。
                </p>
                <div class="field full dm-weight-field">
                  <label>区间规则（可增减）</label>
                  <table class="ai-lead-table dm-weight-table">
                    <thead>
                      <tr>
                        <th>起始天数 ≥</th>
                        <th>结束天数 ≤</th>
                        <th>日私信次数</th>
                        <th class="dm-weight-ops"></th>
                      </tr>
                    </thead>
                    <tbody id="dm-weight-range-rows">${rowsHtml}</tbody>
                  </table>
                  <div style="margin-top:10px">
                    <button type="button" class="tiny" onclick="app.addDmWeightRangeRow()">+ 添加区间</button>
                  </div>
                </div>
                <div class="form-hint" style="margin:12px 0 16px">
                  示例：0～2 天 → 1 次；3～6 天 → 2 次；7～ 留空 → 3 次。区间不可重叠。
                  计划任务 <code>php artisan ai-lead:daily-quota</code> 会按此规则刷新日额度。
                </div>
                <div class="action-bar" style="gap:8px;flex-wrap:wrap">
                  <button class="primary" type="submit">保存规则</button>
                </div>
              </div>
            </form>
          </div>`;
        document.querySelector('#dm-weight-config-form').onsubmit=async (e)=>{
          e.preventDefault();
          if(!this.canManageDmWeightConfig()){this.toast('仅超级管理员可保存',true);return}
          const ranges=this.collectDmWeightRangesFromForm();
          try{
            await this.api('/dm-weight-config',{method:'PUT',body:JSON.stringify({ranges})});
            this.toast('日私信权重已保存');
            this.refresh();
          }catch(err){this.toast(err.message,true)}
        };
      }catch(err){
        host.innerHTML=`<div class="panel"><div class="empty">加载失败：${this.esc(err.message||'')}</div></div>`;
      }
    },
    async resetDmWeightConfig(){
      if(!this.canManageDmWeightConfig()){this.toast('仅超级管理员可操作',true);return}
      if(!confirm('确认恢复系统内置默认阶梯？当前自定义区间将被覆盖。'))return;
      try{
        await this.api('/dm-weight-config/reset',{method:'POST',body:'{}'});
        this.toast('已恢复默认权重');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.dmWeightConfig = true;
})();
