warning: in the working copy of 'app-desarrollo/extensions/cbi-market-recommender/blocks/cbi_market_recommender.liquid', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/app-desarrollo/extensions/cbi-market-recommender/blocks/cbi_market_recommender.liquid b/app-desarrollo/extensions/cbi-market-recommender/blocks/cbi_market_recommender.liquid[m
[1mindex 2cca188..79d52ea 100644[m
[1m--- a/app-desarrollo/extensions/cbi-market-recommender/blocks/cbi_market_recommender.liquid[m
[1m+++ b/app-desarrollo/extensions/cbi-market-recommender/blocks/cbi_market_recommender.liquid[m
[36m@@ -398,6 +398,90 @@[m
             summary.appendChild(item);[m
           });[m
 [m
[32m+[m[32m          const results = document.createElement('section');[m
[32m+[m[32m          results.className = 'cbi-candidate-results';[m
[32m+[m
[32m+[m[32m          const resultsHeading = document.createElement('h3');[m
[32m+[m[32m          resultsHeading.textContent = 'Productos candidatos';[m
[32m+[m[32m          const resultsStatus = document.createElement('p');[m
[32m+[m[32m          resultsStatus.textContent = 'Buscando productos...';[m
[32m+[m[32m          results.append(resultsHeading, resultsStatus);[m
[32m+[m[32m          summary.appendChild(results);[m
[32m+[m
[32m+[m[32m          const answers = questions.flatMap((question, index) =>[m
[32m+[m[32m            Array.from(fieldsets[index].querySelectorAll('input:checked'))[m
[32m+[m[32m              .map(input => ({[m
[32m+[m[32m                questionId: question.id,[m
[32m+[m[32m                optionId: input.value[m
[32m+[m[32m              }))[m
[32m+[m[32m          );[m
[32m+[m
[32m+[m[32m          fetch(endpoint, {[m
[32m+[m[32m            method: 'POST',[m
[32m+[m[32m            headers: { 'Content-Type': 'application/json' },[m
[32m+[m[32m            body: JSON.stringify({ quiz_id: quizId, answers })[m
[32m+[m[32m          })[m
[32m+[m[32m            .then(response => response.json().then(data => {[m
[32m+[m[32m              if (!response.ok) {[m
[32m+[m[32m                throw new Error(data.error || 'No se pudieron obtener candidatos.');[m
[32m+[m[32m              }[m
[32m+[m[32m              return data;[m
[32m+[m[32m            }))[m
[32m+[m[32m            .then(data => {[m
[32m+[m[32m              const candidates =[m
[32m+[m[32m                data.candidates || data.products || data.recommendations || [];[m
[32m+[m
[32m+[m[32m              results.replaceChildren(resultsHeading);[m
[32m+[m
[32m+[m[32m              if (!candidates.length) {[m
[32m+[m[32m                const emptyMessage = document.createElement('p');[m
[32m+[m[32m                emptyMessage.textContent =[m
[32m+[m[32m                  'No encontramos productos candidatos con esas respuestas.';[m
[32m+[m[32m                results.appendChild(emptyMessage);[m
[32m+[m[32m                return;[m
[32m+[m[32m              }[m
[32m+[m
[32m+[m[32m              candidates.forEach(product => {[m
[32m+[m[32m                const item = document.createElement('article');[m
[32m+[m[32m                const title = document.createElement('h4');[m
[32m+[m[32m                title.textContent = product.title || 'Producto sin título';[m
[32m+[m[32m                item.appendChild(title);[m
[32m+[m
[32m+[m[32m                const details = document.createElement('p');[m
[32m+[m[32m                const attributes = [[m
[32m+[m[32m                  product.productType,[m
[32m+[m[32m                  product.vendor[m
[32m+[m[32m                ].filter(Boolean);[m
[32m+[m
[32m+[m[32m                const price = product.price !== null && product.price !== undefined ? { amount: product.price, currencyCode: product.currencyCode } : null;[m
[32m+[m[32m                if (price?.amount) {[m
[32m+[m[32m                  attributes.push([m
[32m+[m[32m                    price.amount + ' ' + (price.currencyCode || '')[m
[32m+[m[32m                  );[m
[32m+[m[32m                }[m
[32m+[m
[32m+[m[32m                details.textContent = attributes.join(' · ');[m
[32m+[m[32m                if (details.textContent) item.appendChild(details);[m
[32m+[m
[32m+[m[32m                const url = product.url || product.onlineStoreUrl ||[m
[32m+[m[32m                  (product.handle ? '/products/' + product.handle : '');[m
[32m+[m
[32m+[m[32m                if (url) {[m
[32m+[m[32m                  const link = document.createElement('a');[m
[32m+[m[32m                  link.href = url;[m
[32m+[m[32m                  link.textContent = 'Ver producto';[m
[32m+[m[32m                  item.appendChild(link);[m
[32m+[m[32m                }[m
[32m+[m
[32m+[m[32m                results.appendChild(item);[m
[32m+[m[32m              });[m
[32m+[m[32m            })[m
[32m+[m[32m            .catch(error => {[m
[32m+[m[32m              console.error('Error al obtener candidatos:', error);[m
[32m+[m[32m              resultsStatus.textContent =[m
[32m+[m[32m                'No se pudieron cargar los candidatos. Inténtalo de nuevo.';[m
[32m+[m[32m            });[m
[32m+[m
           const editButton = document.createElement('button');[m
           editButton.type = 'button';[m
           editButton.className = 'cbi-back';[m
