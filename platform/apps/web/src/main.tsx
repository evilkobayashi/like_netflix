import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './styles.css';

const pages = ['Dashboard','Users','Roles','Permissions','Groups','Workflow Templates','Workflow Executions','Approval Requests','Automation Rules','Automation Executions','Notifications','Audit Logs','Reports','Settings'];
const client = new QueryClient();

function Page({ title }: { title: string } ): React.ReactElement {
  const data = [{ name: 'Mon', value: 4 }, { name: 'Tue', value: 8 }, { name: 'Wed', value: 6 }];
  return <div><h1>{title}</h1>{title === 'Dashboard' && <div style={{ width: 500, height: 240 }}><ResponsiveContainer><LineChart data={data}><XAxis dataKey='name'/><YAxis/><Tooltip/><Line type='monotone' dataKey='value' stroke='#4f46e5'/></LineChart></ResponsiveContainer></div>}</div>;
}

function App( ): React.ReactElement {
  return <BrowserRouter><div className='layout'><aside>{pages.map((p) => <Link key={p} to={p === 'Dashboard' ? '/' : `/${p.toLowerCase().replace(/ /g,'-')}`}>{p}</Link>)}</aside><main><Routes><Route path='/login' element={<Page title='Login'/>}/>{pages.map((p) => <Route key={p} path={p === 'Dashboard' ? '/' : `/${p.toLowerCase().replace(/ /g,'-')}`} element={<Page title={p}/>}/> )}</Routes></main></div></BrowserRouter>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);
