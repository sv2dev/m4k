export function error(status: number, message: string) {
  return new Response(message, { status });
}

export function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
}
