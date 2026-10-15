// Lokalny punkt integracji. Brak dostawcy, sieci, cookies i danych formularza.
// Zewnętrzny odbiornik można dodać dopiero wraz z właściwą obsługą zgód.
type EventName='package_selected'|'date_selected'|'form_started'|'order_saved';
const sentOrders=new Set<number>();
export function track(production:boolean,name:EventName,data:{packageId?:string;orderNumber?:number}={}) {
 if(!production)return;
 if(name==='order_saved'&&data.orderNumber){if(sentOrders.has(data.orderNumber))return;sentOrders.add(data.orderNumber);}
 window.dispatchEvent(new CustomEvent('cp:analytics',{detail:{name,...data}}));
}
