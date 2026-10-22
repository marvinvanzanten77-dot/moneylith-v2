/** Focused coaching on finding work; no invented revenue or changes to financial records. */
export function buildIncomeIdeas(body: Record<string, unknown>) {
  if(!['personal','business-real'].includes(String(body.scope)) || body.purpose!=='income-ideas')throw Error('Onjuiste context voor extra inkomsten.');
  const context=body.context as Record<string,unknown> | undefined;
  if(!context || typeof context.month!=='string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(context.month) || JSON.stringify(body).length>20000)throw Error('Ongeldige context voor opdrachten.');
  return {scope:body.scope as 'personal'|'business-real',businessReplyPolicy:undefined,computedReply:undefined,qualitativeOnly:true,messages:[
    {role:'system' as const,content:'Je bent een positieve, bemoedigende Moneylith-coach voor haalbare extra inkomsten. Help de gebruiker zzp-opdrachten te vinden voor het maken van websites en apps. Geef een korte aanmoediging, twee concrete en kleine acties en een laagdrempelige eerste stap voor vandaag. Denk aan een kleine duidelijke dienst, een bestaand werkvoorbeeld en persoonlijk contact met een passende potentiële klant. Beschrijf voorstellen als mogelijkheden, niet als bewezen vraag of gegarandeerde inkomsten. Wees affirmatief zonder loze lof, druk of schaamte. Maak geen aannames over ervaring, bestaande klanten, tijd, omzet of financiële ruimte. Verzin geen prijzen, bedragen, aantallen klanten, deadlines of besparingen. Gebruik geen cijfers of genummerde lijst. De gebruiker kiest zelf of en hoe een opdracht past. Je benadert niemand en verandert geen administratie. Gebruik korte Nederlandse alinea’s, maximaal 160 woorden.'},
    {role:'user' as const,content:JSON.stringify({month:context.month,scope:body.scope,question:'Help mij positief op weg om extra inkomsten te verwerven met websites en apps voor mensen. Welke kleine stap kan ik vandaag nemen?'})}
  ]};
}
