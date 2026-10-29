import type {AgentDocument} from './agentMemory';
export async function readAgentAttachment(file:File):Promise<AgentDocument>{
 if(file.size>5*1024*1024)throw Error('Een bijlage mag maximaal 5 MB zijn.');
 const extension=file.name.split('.').at(-1)?.toLowerCase();
 let text='',note='';
 if(extension==='txt'){text=await file.text();note='Tekstbestand';}
 else if(extension==='docx'){const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=result.value;note='Word-tekst; controleer tabellen en bedragen.';}
 else if(extension==='pdf'){const {extractTextFromPdfFile}=await import('../utils/documentExtract');const result=await extractTextFromPdfFile(file,{maxPages:10});text=result.text;note=(result.note??'PDF')+' · Maximaal de eerste 10 pagina’s gelezen; controleer de tekst.';}
 else if(['png','jpg','jpeg','webp'].includes(extension??'')){const {extractTextFromImageFile}=await import('../utils/documentExtract');const result=await extractTextFromImageFile(file);text=result.text;note='Tekstherkenning (OCR): controleer bedragen, namen en datums.';}
 else throw Error('Gebruik PDF, DOCX, TXT, PNG, JPG of WEBP.');
 text=text.trim();if(!text)throw Error('Geen leesbare tekst gevonden. Probeer een scherper document of plak de tekst.');
 if(text.length>20000)throw Error('Dit document bevat te veel tekst. Splits het in kleinere delen (maximaal 20.000 tekens).');
 return {id:crypto.randomUUID(),name:file.name.slice(0,200),text,note,createdAt:new Date().toISOString()};
}
