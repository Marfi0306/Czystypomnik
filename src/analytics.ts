import {trackSavedLead,trackMarketingAction,type MarketingAction,type MarketingData} from './marketing';
type EventName=MarketingAction|'date_selected'|'order_saved';
const sentOrders=new Set<number>();
export function track(production:boolean,name:EventName,data:MarketingData&{orderNumber?:number}={}) {
 if(!production)return;
 if(name==='order_saved'&&data.orderNumber){if(sentOrders.has(data.orderNumber))return;sentOrders.add(data.orderNumber);}
 if(name==='order_saved'&&data.submissionId)trackSavedLead(data.submissionId);
 else if(name!=='date_selected'&&name!=='order_saved')trackMarketingAction(name,data);
 window.dispatchEvent(new CustomEvent('cp:analytics',{detail:{name,...data}}));
}
