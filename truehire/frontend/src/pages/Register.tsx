import React from 'react'
import { useForm } from 'react-hook-form'

export default function Register(){
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{name:string; email:string; password:string}>()
  const onSubmit = (data: {name:string; email:string; password:string}) => {
    // TODO: call backend registration when available
    alert(`Welcome, ${data.name}!`)
  }
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Name</label>
          <input className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500" {...register('name', { required: true })} />
          {errors.name && <p className="mt-1 text-sm text-red-600">Name is required</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input type="email" className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500" {...register('email', { required: true })} />
          {errors.email && <p className="mt-1 text-sm text-red-600">Email is required</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <input type="password" className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500" {...register('password', { required: true, minLength: 6 })} />
          {errors.password && <p className="mt-1 text-sm text-red-600">Password must be at least 6 characters</p>}
        </div>
        <button disabled={isSubmitting} className="w-full rounded-md bg-slate-900 py-2 text-white hover:bg-slate-700 disabled:opacity-60">Create account</button>
      </form>
    </div>
  )
}
