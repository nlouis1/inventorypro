'use client';

import Swal, {SweetAlertIcon} from 'sweetalert2';

export async function showAlert(title:string, text='', icon:SweetAlertIcon='info') {
  return Swal.fire({title, text, icon, confirmButtonText:'OK'});
}

export async function showSuccess(text:string, title='Success') {
  return Swal.fire({title, text, icon:'success', confirmButtonText:'OK'});
}

export async function showError(text:string, title='Error') {
  return Swal.fire({title, text, icon:'error', confirmButtonText:'OK'});
}

export async function showConfirm(text:string, title='Please confirm') {
  const result = await Swal.fire({
    title,
    text,
    icon:'warning',
    showCancelButton:true,
    confirmButtonText:'Yes',
    cancelButtonText:'Cancel',
    reverseButtons:true,
    focusCancel:true,
  });
  return result.isConfirmed;
}

export async function showPrompt(text:string, defaultValue='', title='Enter a value') {
  const result = await Swal.fire({
    title,
    text,
    input:'text',
    inputValue:defaultValue,
    inputPlaceholder:'Enter a value',
    showCancelButton:true,
    confirmButtonText:'Continue',
    cancelButtonText:'Cancel',
    reverseButtons:true,
    inputValidator:(value)=>value.trim() ? undefined : 'A value is required.',
  });
  return result.isConfirmed ? String(result.value ?? '') : null;
}

export function showToast(text:string, icon:SweetAlertIcon='success') {
  return Swal.fire({
    toast:true,
    position:'top-end',
    icon,
    title:text,
    showConfirmButton:false,
    timer:3000,
    timerProgressBar:true,
  });
}
