import {z} from 'zod';

const id=z.string().regex(/^cp-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
const empty=z.object({}).strict();
const packageData=z.object({content_ids:z.tuple([z.enum(['silver','gold','platinum'])]),content_type:z.literal('product')}).strict();
// Lead is deliberately absent: only the successful order-save handler may emit it.
export const marketingEventSchema=z.discriminatedUnion('name',[
 z.object({name:z.literal('PageView'),id,data:empty}).strict(),
 z.object({name:z.literal('ViewContent'),id,data:packageData}).strict(),
 z.object({name:z.literal('PackageSelected'),id,data:packageData}).strict(),
 z.object({name:z.literal('Search'),id,data:z.object({content_category:z.literal('cemetery')}).strict()}).strict(),
 z.object({name:z.literal('FormStart'),id,data:empty}).strict(),
 z.object({name:z.literal('FormStep'),id,data:z.object({step:z.union([z.literal(2),z.literal(3)])}).strict()}).strict(),
 z.object({name:z.literal('FormSubmit'),id,data:empty}).strict(),
 z.object({name:z.literal('FormError'),id,data:empty}).strict(),
 z.object({name:z.literal('Contact'),id,data:z.object({contact_method:z.enum(['phone','email'])}).strict()}).strict(),
]);
export const marketingBatchSchema=z.object({events:z.array(marketingEventSchema).min(1).max(10)}).strict();
export type MarketingEvent=z.infer<typeof marketingEventSchema>;
