import {trackSavedLead} from './marketing';
type EventName='package_selected'|'date_selected'|'form_started'|'order_saved';
const sentOrders=new Set<number>();
export function track(production:boolean,name:EventName,data:{packageId?:string;orderNumber?:number;submissionId?:string}={}) {
 if(!production)return;
 if(name==='order_saved'&&data.orderNumber){if(sentOrders.has(data.orderNumber))return;sentOrders.add(data.orderNumber);}
 if(name==='order_saved'&&data.submissionId)trackSavedLead(data.submissionId);
 window.dispatchEvent(new CustomEvent('cp:analytics',{detail:{name,...data}}));
}
