import {spendingCategoryLabel} from './classificationRules.js';
import type {SpendingPot} from './spending.js';
export type ChoiceLimits = Record<string, number>; // User-chosen monthly ceilings in integer cents; not expenses.
export const choiceLimitsKey = 'moneylith.personal.spendingLimits.v1';
export function validateChoiceLimits(value:unknown):value is ChoiceLimits {
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).length<=100&&Object.entries(value).every(([label,cents])=>label.trim().length>0&&label.length<=150&&!['Tanken','Boodschappen'].includes(label)&&!label.endsWith(' — boven maandbudget')&&Number.isSafeInteger(cents)&&Number(cents)>=0&&Number(cents)<=1e9);
}
export function choiceProfile(label:string){
 switch(spendingCategoryLabel(label)){
  case 'Coffeeshop':return {title:'Kans om te minderen',tip:'Kies eens een coffeeshopmoment minder en plan daarvoor iets anders waar je naar uitkijkt. Een wandeling of een ontspannen avond thuis hoeft geen extra aankoop te betekenen.'};
  case 'Koffie, snacks en rookwaar':return {title:'Kans om te minderen',tip:'Kies één aankoopmoment om over te slaan of neem drinken en een tussendoortje mee. Deze groep maakt geen onderscheid tussen koffie, snacks en rookwaar; de app kan niet zien wat je precies kocht.'};
  case 'Gezondheid en welzijn':return {title:'Bewust ruimte voor maken',tip:'Een saunabezoek kan een bewust ontspanningsmoment voor je zijn. Plan het binnen je grens en financiële ruimte. Deze categorie bevat ook zorg: stel noodzakelijke zorg niet uit om een uitgavendoel te halen.'};
  case 'Vrije tijd en uitjes':return {title:'Kies wat je echt iets brengt',tip:'Kies een uitje waar je naar uitkijkt. Vergelijk een betaalde activiteit met een gratis alternatief; plezier hoeft niet telkens een nieuwe aankoop te zijn.'};
  case 'Spullen en huishouden':return {title:'Even afwegen vóór je koopt',tip:'Is het nodig, vervangt het iets, en ga je het gebruiken? Zet een niet-noodzakelijke aankoop eerst op een wensenlijst. Lenen, repareren of tweedehands kan ook passen.'};
  case 'Kleding en schoenen':return {title:'Nodig of een impuls?',tip:'Kijk wat je mist en wat je al hebt. Geef voorrang aan iets dat je vaak draagt; laat een impulsaankoop nog even liggen.'};
  case 'Eten en drinken buiten de deur':return {title:'Maak er een bewuste keuze van',tip:'Kies de momenten die je belangrijk vindt. Zelf koken of iets meenemen op andere dagen kan ruimte laten voor een etentje dat je echt wilt.'};
  case 'Persoonlijke verzorging':return {title:'Verzorging met een grens',tip:'Maak ruimte voor wat je nodig hebt. Gebruik producten eerst op en kijk of extra aankopen of behandelingen nu passen.'};
  case 'Vervoer en parkeren':return {title:'Vergelijk haalbare alternatieven',tip:'Bekijk waar lopen, fietsen, openbaar vervoer of het combineren van ritten praktisch is. Noodzakelijke ritten zijn geen mislukte besparing.'};
  case 'Cadeaus en donaties':return {title:'Geven binnen je mogelijkheden',tip:'Kies vooraf wat je kunt missen. Aandacht, hulp of een zelfgemaakt cadeau kan ook waardevol zijn.'};
  default:return {title:'Kies bewust',tip:'Kijk welke aankopen nodig zijn en welke je zou kunnen uitstellen. Een lagere uitgave is alleen vooruitgang als die past bij jouw behoeften.'};
 }
}
export function choiceAssessment(pot:SpendingPot,limits:ChoiceLimits){
 const limit=Object.hasOwn(limits,pot.label)?limits[pot.label]:null;
 const status=limit===null?'unknown':pot.cents>limit?'over':limit===0||pot.cents>=Math.ceil(limit*.8)?'near':'within';
 return {...choiceProfile(pot.label),status,limit,remaining:limit===null?null:Math.max(0,limit-pot.cents)};
}
export const choiceCoachPolicy = 'Maak twee afzonderlijke afwegingen: de bedoeling van de aankoop en de financiële grens. Stimuleer minderen bij coffeeshop en rookwaar, en bewust omgaan met snack- en koffiemomenten; stel een haalbaar alternatief voor, geen grotere of voordeligere voorraad. Gemengde potjes bewijzen niet wat iemand heeft gekocht. Ontspanning, zoals een saunabezoek dat de gebruiker waardeert, mag positief worden benaderd, maar nooit als medisch gezond of automatisch betaalbaar. De categorie Gezondheid en welzijn omvat ook noodzakelijke zorg: moedig uitstel daarvan niet aan. Ook bij een positieve bedoeling gaat een overschreden grens voor: benoem eerst het financiële aandachtspunt. Zonder grens of volledige financiële context is betaalbaarheid onbekend. Een keuzegrens is geen extra uitgave en geen garantie dat er geld over is. Geef geen morele labels aan de persoon, diagnose of beloofde gezondheidswinst. Kies één kleine, concrete uitdaging die past bij het potje; de gebruiker houdt de keuze.';
