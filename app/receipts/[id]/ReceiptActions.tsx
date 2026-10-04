'use client';
import {showAlert} from '../../../components/swal';

export default function ReceiptActions(){
 async function printReceipt(){
  try{
   const images=Array.from(document.images);
   await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();})));
   if(document.fonts?.ready) await document.fonts.ready;
   window.focus();
   setTimeout(()=>window.print(),250);
  }catch(error){
   void showAlert('Printing failed',error instanceof Error?error.message:'Unable to prepare the receipt for printing.','error');
  }
 }
 return <div className="print-actions"><button onClick={printReceipt}>Print / Save PDF</button><button onClick={()=>window.history.back()}>Back</button></div>;
}
